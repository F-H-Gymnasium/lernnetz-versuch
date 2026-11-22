import {
    collection, doc, writeBatch, onSnapshot, query, orderBy,
    updateDoc, setDoc, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

/* =========================================================
   LernNetz MailService (intern, über Firestore)

   Datenmodell:  mailboxes/{email}/messages/{id}
   Jeder Nutzer hat sein eigenes Postfach. Beim Senden bekommt
   jeder Empfänger eine eigene Kopie (folder: "inbox") und der
   Absender eine Kopie in "sent". Bcc steht nur in der Kopie
   des Absenders.  Entwürfe liegen in "draft".
   ========================================================= */

const $ = (id) => document.getElementById(id);

let db = null;
let getUser = () => null;
let unsubscribe = null;

let messages = [];          // alle Nachrichten des eingeloggten Nutzers
let directory = [];         // Adressbuch: { email, name, role }
let currentFolder = "inbox";
let openedMail = null;      // aktuell im Lesefenster geöffnet
let draftId = null;         // ID des Entwurfs, der gerade bearbeitet wird
let pickerTarget = null;    // Feld, in das der Adressbuch-Picker einträgt
let wired = false;

/* ---------- Hilfsfunktionen ---------- */
function me() {
    const u = getUser();
    return u ? u.email.toLowerCase() : null;
}

function messagesCol(email) {
    return collection(db, "mailboxes", email, "messages");
}

function toDate(v) {
    return v && typeof v.toDate === "function" ? v.toDate() : new Date();
}

function fmtDate(d) {
    return d.toLocaleString("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    }).replace(",", "");
}

function fmtSize(m) {
    const bytes = new Blob([(m.subject || "") + (m.body || "") + (m.from || "")]).size;
    if (bytes < 1024) return bytes + " B";
    return (bytes / 1024).toFixed(2).replace(".", ",").replace(/,?0+$/, "") + " KB";
}

function cell(text, className) {
    const td = document.createElement("td");
    if (text !== undefined) td.innerText = text;
    if (className) td.className = className;
    return td;
}

function prefixSubject(prefix, subject) {
    const s = (subject || "").trim();
    const re = new RegExp("^" + prefix.replace(":", "\\:") , "i");
    return re.test(s) ? s : prefix + " " + s;
}

function quoted(m) {
    return "\n\n----- Ursprüngliche Nachricht -----\n" +
        `Von: ${m.from}\n` +
        `Datum: ${fmtDate(toDate(m.createdAt))}\n` +
        `An: ${(m.to || []).join(", ")}\n` +
        `Betreff: ${m.subject || ""}\n\n` +
        (m.body || "");
}

/* ---------- Start / Stop (wird von script.js aufgerufen) ---------- */
export function initMail(database, userGetter) {
    db = database;
    getUser = userGetter;
    if (!wired) {
        wireEvents();
        wired = true;
    }
}

export async function startMail() {
    stopMail();
    const email = me();
    if (!email) return;

    await loadDirectory();

    const q = query(messagesCol(email), orderBy("createdAt", "desc"));
    unsubscribe = onSnapshot(q, (snap) => {
        messages = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }));
        render();
        updateUnread();
    }, (err) => {
        console.error("Postfach konnte nicht geladen werden (Firestore-Regeln prüfen):", err);
    });
}

export function stopMail() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    messages = [];
    directory = [];
    closeModals();
    render();
    updateUnread();
}

export function showMailView() {
    render();
}

/* ---------- Adressbuch ---------- */
async function loadDirectory() {
    try {
        const snap = await getDocs(collection(db, "users"));
        directory = snap.docs.map(d => ({
            email: d.id.toLowerCase(),
            name: (d.data().name || "").trim(),
            role: d.data().role
        }));
    } catch (e) {
        console.error("Adressbuch konnte nicht geladen werden (Firestore-Regeln prüfen):", e);
        directory = [];
    }
}

// Text wie "max@schule.de; Anna Müller; lehrer1" -> { emails, errors }
function resolveField(text) {
    const emails = [];
    const errors = [];
    const tokens = text.split(/[;,\n]/).map(t => t.trim()).filter(Boolean);

    tokens.forEach(token => {
        const low = token.toLowerCase();
        let found = directory.filter(u => u.email === low);                              // 1. exakte E-Mail
        if (!found.length) found = directory.filter(u => u.name && u.name.toLowerCase() === low);  // 2. Name
        if (!found.length) found = directory.filter(u => u.email.split("@")[0] === low);           // 3. Teil vor dem @

        if (found.length === 0) errors.push(`„${token}" wurde nicht gefunden.`);
        else if (found.length > 1) errors.push(`„${token}" ist nicht eindeutig. Bitte die E-Mail-Adresse verwenden.`);
        else emails.push(found[0].email);
    });

    return { emails, errors };
}

/* ---------- Anzeige: Liste ---------- */
function updateUnread() {
    const n = messages.filter(m => m.folder === "inbox" && !m.read).length;
    const link = $("mail-summary-link");
    if (link) link.innerText = `${n} ungelesene E-Mail(s)`;
}

function render() {
    const tbody = $("mail-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    $("mail-party-th").innerText = currentFolder === "inbox" ? "Absender" : "Empfänger";
    $("mail-select-all").checked = false;

    const filter = $("mail-filter").value;
    const term = ($("mail-search").value || "").trim().toLowerCase();

    const list = messages.filter(m => {
        if (m.folder !== currentFolder) return false;
        if (filter === "unread" && (m.folder !== "inbox" || m.read)) return false;
        if (term) {
            const hay = `${m.subject || ""} ${m.body || ""} ${m.from || ""} ${(m.to || []).join(" ")}`.toLowerCase();
            if (!hay.includes(term)) return false;
        }
        return true;
    });

    $("mail-count").innerText = `${list.length} E-Mail(s)`;

    if (!list.length) {
        const tr = document.createElement("tr");
        tr.appendChild(Object.assign(cell("Keine E-Mails in diesem Ordner.", "muted-cell"), { colSpan: 7 }));
        tbody.appendChild(tr);
        return;
    }

    list.forEach(m => {
        const tr = document.createElement("tr");
        if (m.folder === "inbox" && !m.read) tr.className = "unread";

        // Checkbox
        const tdCheck = cell();
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "mail-check";
        cb.dataset.id = m.id;
        tdCheck.appendChild(cb);

        // Funktionen
        const tdFn = cell();
        const readBtn = document.createElement("button");
        readBtn.className = "icon-btn";
        readBtn.title = "Öffnen";
        readBtn.innerText = "👓";
        readBtn.addEventListener("click", () => openMessage(m));
        const delBtn = document.createElement("button");
        delBtn.className = "icon-btn";
        delBtn.title = "Löschen";
        delBtn.innerText = "🗑️";
        delBtn.addEventListener("click", () => deleteMails([m.id]));
        tdFn.append(readBtn, delBtn);

        // Status
        const tdStatus = cell(m.folder === "draft" ? "📝" : (m.read ? "📭" : "✉️"));

        // Betreff
        const tdSubject = cell();
        const a = document.createElement("a");
        a.href = "#";
        a.className = "mail-link";
        a.innerText = m.subject || "- Betreff -";
        a.addEventListener("click", (e) => { e.preventDefault(); openMessage(m); });
        tdSubject.appendChild(a);

        // Absender / Empfänger
        let party;
        if (m.folder === "inbox") party = m.from;
        else if (m.folder === "draft") party = m.toText || "";
        else party = (m.to || []).join(", ");

        tr.append(tdCheck, tdFn, tdStatus, tdSubject, cell(party), cell(fmtSize(m)), cell(fmtDate(toDate(m.createdAt))));
        tbody.appendChild(tr);
    });
}

/* ---------- Fenster (Modals) ---------- */
function showModal(id) {
    $("mail-modal-backdrop").classList.remove("hidden");
    $("mail-compose").classList.add("hidden");
    $("mail-read").classList.add("hidden");
    $(id).classList.remove("hidden");
}

function closeModals() {
    const bd = $("mail-modal-backdrop");
    if (!bd) return;
    bd.classList.add("hidden");
    $("mail-compose").classList.add("hidden");
    $("mail-read").classList.add("hidden");
    $("addr-picker").classList.add("hidden");
    openedMail = null;
    draftId = null;
}

function openMessage(m) {
    if (m.folder === "draft") {
        openCompose({
            to: m.toText || "", cc: m.ccText || "", bcc: m.bccText || "",
            subject: m.subject || "", body: m.body || "", draft: m.id
        });
    } else {
        openRead(m);
    }
}

function openRead(m) {
    openedMail = m;
    $("r-from").innerText = m.from || "";
    $("r-date").innerText = fmtDate(toDate(m.createdAt));
    $("r-to").innerText = (m.to || []).join(", ");

    const hasCc = m.cc && m.cc.length;
    $("r-cc-row").classList.toggle("hidden", !hasCc);
    $("r-cc").innerText = hasCc ? m.cc.join(", ") : "";

    const hasBcc = m.bcc && m.bcc.length;
    $("r-bcc-row").classList.toggle("hidden", !hasBcc);
    $("r-bcc").innerText = hasBcc ? m.bcc.join(", ") : "";

    $("r-subject").innerText = m.subject || "- Betreff -";
    const body = $("r-body");
    body.innerText = m.body || "- Text -";
    body.classList.toggle("empty", !m.body);

    showModal("mail-read");

    // Als gelesen markieren
    if (m.folder === "inbox" && !m.read) {
        updateDoc(doc(db, "mailboxes", me(), "messages", m.id), { read: true })
            .catch(e => console.error("Konnte nicht als gelesen markieren:", e));
    }
}

function openCompose({ to = "", cc = "", bcc = "", subject = "", body = "", draft = null } = {}) {
    draftId = draft;
    $("c-from").innerText = me();
    $("c-date").innerText = fmtDate(new Date());
    $("c-to").value = to;
    $("c-cc").value = cc;
    $("c-bcc").value = bcc;
    $("c-subject").value = subject;
    $("c-body").value = body;
    $("c-error").innerText = "";
    $("addr-picker").classList.add("hidden");
    showModal("mail-compose");
    (to ? $("c-subject") : $("c-to")).focus();
}

/* ---------- Senden / Entwurf ---------- */
async function sendMail() {
    const sender = me();
    const errorBox = $("c-error");
    errorBox.style.color = "red";
    errorBox.innerText = "";

    const to = resolveField($("c-to").value);
    const cc = resolveField($("c-cc").value);
    const bcc = resolveField($("c-bcc").value);

    const errors = [...to.errors, ...cc.errors, ...bcc.errors];
    if (errors.length) {
        if (!directory.length) errors.push("Das Adressbuch ist leer oder konnte nicht geladen werden.");
        errorBox.innerText = errors.join(" ");
        return;
    }

    const all = [...new Set([...to.emails, ...cc.emails, ...bcc.emails])];
    if (!all.length) {
        errorBox.innerText = "Bitte mindestens einen Empfänger angeben.";
        return;
    }

    const subject = $("c-subject").value.trim();
    const body = $("c-body").value;
    const base = { from: sender, to: to.emails, cc: cc.emails, subject, body, createdAt: serverTimestamp() };

    $("c-send").disabled = true;
    try {
        const batch = writeBatch(db);

        // Kopie für jeden Empfänger (ohne Bcc-Liste)
        all.forEach(r => {
            batch.set(doc(messagesCol(r)), { ...base, folder: "inbox", read: false });
        });

        // Kopie für den Absender (mit Bcc)
        batch.set(doc(messagesCol(sender)), { ...base, bcc: bcc.emails, folder: "sent", read: true });

        // Entwurf entfernen, falls es einer war
        if (draftId) batch.delete(doc(db, "mailboxes", sender, "messages", draftId));

        await batch.commit();
        closeModals();
    } catch (e) {
        console.error(e);
        errorBox.innerText = "Fehler beim Senden: " + e.message + " (Firestore-Regeln prüfen)";
    } finally {
        $("c-send").disabled = false;
    }
}

async function saveDraft() {
    const sender = me();
    const errorBox = $("c-error");
    errorBox.style.color = "red";
    errorBox.innerText = "";

    try {
        const ref = draftId ? doc(db, "mailboxes", sender, "messages", draftId) : doc(messagesCol(sender));
        await setDoc(ref, {
            folder: "draft",
            from: sender,
            to: [], cc: [], bcc: [],
            toText: $("c-to").value,
            ccText: $("c-cc").value,
            bccText: $("c-bcc").value,
            subject: $("c-subject").value.trim(),
            body: $("c-body").value,
            read: true,
            createdAt: serverTimestamp()
        });
        closeModals();
        currentFolder = "draft";
        $("mail-folder").value = "draft";
        render();
    } catch (e) {
        console.error(e);
        errorBox.innerText = "Fehler beim Speichern des Entwurfs: " + e.message;
    }
}

/* ---------- Löschen ---------- */
async function deleteMails(ids) {
    if (!ids.length) return;
    if (!confirm(`${ids.length} E-Mail(s) wirklich löschen?`)) return;

    try {
        const batch = writeBatch(db);
        ids.forEach(id => batch.delete(doc(db, "mailboxes", me(), "messages", id)));
        await batch.commit();
        if (openedMail && ids.includes(openedMail.id)) closeModals();
    } catch (e) {
        console.error(e);
        alert("Fehler beim Löschen: " + e.message);
    }
}

/* ---------- Adressbuch-Picker ---------- */
function openPicker(targetId) {
    pickerTarget = targetId;
    $("addr-filter").value = "";
    renderPicker("");
    $("addr-picker").classList.remove("hidden");
    $("addr-filter").focus();
}

function renderPicker(filter) {
    const list = $("addr-list");
    list.innerHTML = "";
    const f = filter.trim().toLowerCase();

    const users = directory
        .filter(u => !f || u.email.includes(f) || u.name.toLowerCase().includes(f))
        .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

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
            const input = $(pickerTarget);
            const cur = input.value.trim().replace(/[;,]\s*$/, "");
            input.value = cur ? cur + "; " + u.email : u.email;
            $("addr-picker").classList.add("hidden");
            input.focus();
        });
        list.appendChild(d);
    });
}

/* ---------- Events ---------- */
function wireEvents() {
    // Links über der Liste
    $("mail-link-new").addEventListener("click", (e) => { e.preventDefault(); openCompose(); });
    $("mail-link-search").addEventListener("click", (e) => {
        e.preventDefault();
        $("mail-search-bar").classList.toggle("hidden");
        if (!$("mail-search-bar").classList.contains("hidden")) $("mail-search").focus();
    });
    $("mail-link-refresh").addEventListener("click", (e) => { e.preventDefault(); render(); });

    $("mail-search").addEventListener("input", render);
    $("mail-filter").addEventListener("change", render);
    $("mail-folder").addEventListener("change", (e) => {
        currentFolder = e.target.value;
        render();
    });

    $("mail-select-all").addEventListener("change", (e) => {
        document.querySelectorAll(".mail-check").forEach(cb => cb.checked = e.target.checked);
    });
    $("mail-delete-selected").addEventListener("click", () => {
        const ids = [...document.querySelectorAll(".mail-check:checked")].map(cb => cb.dataset.id);
        deleteMails(ids);
    });

    // Fenster
    document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", closeModals));
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !$("mail-modal-backdrop").classList.contains("hidden")) closeModals();
    });

    $("c-send").addEventListener("click", sendMail);
    $("c-draft").addEventListener("click", saveDraft);

    document.querySelectorAll(".addr-btn").forEach(btn =>
        btn.addEventListener("click", () => openPicker(btn.dataset.target))
    );
    $("addr-filter").addEventListener("input", (e) => renderPicker(e.target.value));

    // Lesefenster: Antworten / Weiterleiten / Bearbeiten / Löschen
    $("r-reply").addEventListener("click", () => {
        const m = openedMail;
        if (!m) return;
        const to = m.folder === "sent" ? (m.to || []).join("; ") : m.from;
        openCompose({ to, subject: prefixSubject("Re:", m.subject), body: quoted(m) });
    });
    $("r-forward").addEventListener("click", () => {
        const m = openedMail;
        if (!m) return;
        openCompose({ subject: prefixSubject("Fw:", m.subject), body: quoted(m) });
    });
    $("r-edit").addEventListener("click", () => {
        const m = openedMail;
        if (!m) return;
        openCompose({
            to: (m.to || []).join("; "),
            cc: (m.cc || []).join("; "),
            bcc: (m.bcc || []).join("; "),
            subject: m.subject || "",
            body: m.body || ""
        });
    });
    $("r-delete").addEventListener("click", () => {
        if (openedMail) deleteMails([openedMail.id]);
    });
}
