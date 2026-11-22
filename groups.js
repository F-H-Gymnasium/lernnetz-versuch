import {
    collection, doc, setDoc, onSnapshot, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { resolveField, getDirectory } from "./mail.js";

/* =========================================================
   LernNetz Klassen & Gruppen

   Collection "groups", ein Dokument pro Klasse/Gruppe:
     name       – Name
     type       – "class" oder "group"
     owner      – E-Mail des Erstellers (immer der Owner)
     ownerName  – Anzeigename des Owners (Fallback: E-Mail)
     members    – Liste aller Mitglieder-E-Mails (inkl. Owner)
     look       – Aussehen der Karte (vorerst immer "people")
     createdAt  – Zeitstempel

   Jeder sieht nur die Klassen/Gruppen, in denen er Mitglied ist.
   ========================================================= */

const $ = (id) => document.getElementById(id);

const LABELS = {
    class: { title: "Neue Klasse erstellen", nameQuestion: "Wie soll die Klasse heißen?" },
    group: { title: "Neue Gruppe erstellen", nameQuestion: "Wie soll die Gruppe heißen?" }
};

let db = null;
let getUser = () => null;
let unsubscribe = null;
let groups = [];
let createType = "class";
let wired = false;

function me() {
    const u = getUser();
    return u ? u.email.toLowerCase() : null;
}

/* ---------- Start / Stop (wird von script.js aufgerufen) ---------- */
export function initGroups(database, userGetter) {
    db = database;
    getUser = userGetter;
    if (!wired) {
        wireEvents();
        wired = true;
    }
}

export function startGroups() {
    stopGroups();
    const email = me();
    if (!email) return;

    const q = query(collection(db, "groups"), where("members", "array-contains", email));
    unsubscribe = onSnapshot(q, (snap) => {
        groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
    }, (err) => {
        console.error("Klassen/Gruppen konnten nicht geladen werden (Firestore-Regeln prüfen):", err);
    });
}

export function stopGroups() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    groups = [];
    closeModal();
    render();
}

/* ---------- Anzeige ---------- */
function render() {
    renderCards("start-classes", groups.filter(g => g.type === "class"));
    renderCards("start-groups", groups.filter(g => g.type === "group"));
}

function renderCards(containerId, items) {
    const box = $(containerId);
    if (!box) return;
    box.innerHTML = "";

    [...items]
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"))
        .forEach(g => {
            const card = document.createElement("div");
            card.className = "class-card";

            const img = document.createElement("div");
            img.className = "class-card-image " + (g.look || "people");

            const body = document.createElement("div");
            body.className = "class-card-body";

            const link = document.createElement("a");
            link.href = "#";
            link.innerText = g.name;
            link.addEventListener("click", (e) => e.preventDefault());

            const p = document.createElement("p");
            p.append(document.createTextNode((g.ownerName || g.owner) + " "));
            const icon = document.createElement("span");
            icon.className = "contact-icon";
            p.appendChild(icon);

            body.append(link, p);
            card.append(img, body);
            box.appendChild(card);
        });
}

/* ---------- Erstellen-Fenster ---------- */
function openModal(type) {
    createType = type;
    $("group-modal-title").innerText = LABELS[type].title;
    $("g-name-label").innerText = LABELS[type].nameQuestion;
    $("g-name").value = "";
    $("g-members").value = "";
    $("g-error").innerText = "";
    $("g-picker").classList.add("hidden");
    $("group-modal-backdrop").classList.remove("hidden");
    $("g-name").focus();
}

function closeModal() {
    const bd = $("group-modal-backdrop");
    if (bd) bd.classList.add("hidden");
}

async function createGroup() {
    const errorBox = $("g-error");
    errorBox.style.color = "red";
    errorBox.innerText = "";

    const owner = me();
    if (!owner) return;

    const name = $("g-name").value.trim();
    if (!name) {
        errorBox.innerText = "Bitte einen Namen eingeben.";
        return;
    }

    const res = resolveField($("g-members").value);
    if (res.errors.length) {
        if (!getDirectory().length) res.errors.push("Das Adressbuch ist leer oder konnte nicht geladen werden.");
        errorBox.innerText = res.errors.join(" ");
        return;
    }

    // Der Ersteller ist immer Owner und Mitglied
    const members = [...new Set([owner, ...res.emails])];
    const self = getDirectory().find(u => u.email === owner);

    $("g-create").disabled = true;
    try {
        await setDoc(doc(collection(db, "groups")), {
            name,
            type: createType,
            owner,
            ownerName: (self && self.name) || owner,
            members,
            look: "people",
            createdAt: serverTimestamp()
        });
        closeModal();
    } catch (e) {
        console.error(e);
        errorBox.innerText = "Fehler beim Erstellen: " + e.message + " (Firestore-Regeln prüfen)";
    } finally {
        $("g-create").disabled = false;
    }
}

/* ---------- Adressbuch-Auswahl ---------- */
function renderPicker(filter) {
    const list = $("g-addr-list");
    list.innerHTML = "";
    const f = filter.trim().toLowerCase();

    const users = getDirectory()
        .filter(u => u.email !== me())
        .filter(u => !f || u.email.includes(f) || u.name.toLowerCase().includes(f))
        .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "de"));

    if (!users.length) {
        const d = document.createElement("div");
        d.className = "addr-item muted-cell";
        d.innerText = "Keine Einträge.";
        list.appendChild(d);
        return;
    }

    users.forEach(u => {
        const d = document.createElement("div");
        d.className = "addr-item";
        d.innerText = u.name ? `${u.name} – ${u.email}` : u.email;
        d.addEventListener("click", () => {
            const input = $("g-members");
            const cur = input.value.trim().replace(/[;,]\s*$/, "");
            input.value = cur ? cur + "; " + u.email : u.email;
            $("g-picker").classList.add("hidden");
            input.focus();
        });
        list.appendChild(d);
    });
}

/* ---------- Events ---------- */
function wireEvents() {
    $("new-class-link").addEventListener("click", (e) => { e.preventDefault(); openModal("class"); });
    $("new-group-link").addEventListener("click", (e) => { e.preventDefault(); openModal("group"); });

    $("g-close").addEventListener("click", closeModal);
    $("g-cancel").addEventListener("click", closeModal);
    $("g-create").addEventListener("click", createGroup);

    $("g-name").addEventListener("keydown", (e) => { if (e.key === "Enter") createGroup(); });

    $("g-addr-btn").addEventListener("click", () => {
        $("g-addr-filter").value = "";
        renderPicker("");
        $("g-picker").classList.remove("hidden");
        $("g-addr-filter").focus();
    });
    $("g-addr-filter").addEventListener("input", (e) => renderPicker(e.target.value));

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !$("group-modal-backdrop").classList.contains("hidden")) closeModal();
    });
}
