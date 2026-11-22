import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { initMail, startMail, stopMail, showMailView } from "./mail.js";
import { initGroups, startGroups, stopGroups } from "./groups.js";

/* =========================================================
   FIREBASE
   ========================================================= */
const firebaseConfig = {
    apiKey: "AIzaSyBJDxfrc0YamrkoTlSY8H8TTzjBVvGNYXg",
    authDomain: "lernnetz-3e076.firebaseapp.com",
    projectId: "lernnetz-3e076",
    storageBucket: "lernnetz-3e076.firebasestorage.app",
    messagingSenderId: "916848257433",
    appId: "1:916848257433:web:34eb4158a832a69bf48b08",
    measurementId: "G-NBESQV0SHS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================================================
   KONSTANTEN & ZUSTAND
   ========================================================= */
const DEFAULT_SCHOOL_NAME = "LernNetz Schule";

// Alle Rollen, die es gibt (Schlüssel = Wert in Firestore)
const ROLES = {
    admin: "Administrator",
    teacher: "Lehrer",
    student: "Schüler"
};

let currentUser = null;
let currentRole = "student";
let globalSchoolName = DEFAULT_SCHOOL_NAME;

// MailService initialisieren (nutzt immer den aktuell eingeloggten Nutzer)
initMail(db, () => currentUser);
initGroups(db, () => currentUser);

/* =========================================================
   DOM
   ========================================================= */
const $ = (id) => document.getElementById(id);

const loginView = $("login-view");
const dashboardView = $("dashboard-view");
const emailInput = $("email");
const passwordInput = $("password");
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const messageText = $("message");
const userDisplayName = $("user-display-name");
const userPath = $("user-path");

const roomBtn = $("roomBtn");
const roomDropdown = $("room-dropdown");
const schoolSelectBtn = $("school-select-btn");
const toolList = $("tool-list");
const placeholderTitle = $("placeholder-title");

const settingsSchoolName = $("settings-schoolname");
const settingsMaintenance = $("settings-maintenance");
const saveSettingsBtn = $("saveSettingsBtn");
const settingsMessage = $("settings-message");

const roleEmail = $("role-email");
const roleName = $("role-name");
const roleSelect = $("role-select");
const saveRoleBtn = $("saveRoleBtn");
const roleMessage = $("role-message");
const usersTbody = $("users-tbody");

/* =========================================================
   STARTSEITE (Klassen & Gruppen kommen aus groups.js)
   ========================================================= */
function initStartPage() {

    // Tabs "Status" / "Pinnwand"
    const tabs = document.querySelectorAll("#start-tabs .tab");
    tabs.forEach(tab => tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.toggle("active", t === tab));
        $("start-status").classList.toggle("hidden", tab.dataset.tab !== "status");
        $("start-pinnwand").classList.toggle("hidden", tab.dataset.tab !== "pinnwand");
    }));

    // Abschnitte ein-/ausklappen
    document.querySelectorAll(".minimize-btn[data-target]").forEach(btn => btn.addEventListener("click", () => {
        const target = $(btn.dataset.target);
        const hide = !target.classList.contains("hidden");
        target.classList.toggle("hidden", hide);
        btn.innerText = hide ? "+" : "—";
    }));

    // Platzhalter-Links auf der Startseite springen nicht nach oben
    document.querySelectorAll("#view-start a[href='#']").forEach(a =>
        a.addEventListener("click", (e) => e.preventDefault())
    );
}

initStartPage();

/* =========================================================
   HILFSFUNKTIONEN
   ========================================================= */
function setStatus(el, text, color) {
    if (!el) return;
    el.innerText = text;
    el.style.color = color || "";
}

// Schulname überall im HTML einsetzen
function applySchoolName(name) {
    globalSchoolName = name || DEFAULT_SCHOOL_NAME;
    document.querySelectorAll(".current-school-name").forEach(el => el.innerText = globalSchoolName);
}

// Globale Konfiguration laden (config/global)
async function loadSchoolConfig() {
    try {
        const snap = await getDoc(doc(db, "config", "global"));
        if (snap.exists()) {
            const data = snap.data();
            applySchoolName(data.schoolName);
            return { schoolName: globalSchoolName, maintenanceMode: !!data.maintenanceMode };
        }
    } catch (e) {
        console.error("Konfiguration konnte nicht geladen werden (Firestore-Regeln prüfen):", e);
    }
    applySchoolName(DEFAULT_SCHOOL_NAME);
    return { schoolName: DEFAULT_SCHOOL_NAME, maintenanceMode: false };
}

// Rolle des Benutzers aus users/<email> laden
async function loadUserRole(email) {
    try {
        const snap = await getDoc(doc(db, "users", email.toLowerCase()));
        if (snap.exists()) {
            const role = snap.data().role;
            if (ROLES[role]) return { role, assigned: true };
            console.warn(`Unbekannte Rolle "${role}" für ${email} – fällt auf Schüler zurück.`);
        } else {
            console.warn(`Kein users-Dokument für ${email} – gilt als Schüler.`);
        }
    } catch (e) {
        console.error("Rolle konnte nicht geladen werden (Firestore-Regeln prüfen):", e);
    }
    return { role: "student", assigned: false };
}

/* =========================================================
   ROLLEN-UI & VIEWS
   ========================================================= */
// Elemente mit data-roles="admin,teacher" nur für diese Rollen zeigen
function applyRoleUI(role) {
    document.querySelectorAll("[data-roles]").forEach(el => {
        const allowed = el.dataset.roles.split(",").map(r => r.trim());
        el.classList.toggle("hidden", !allowed.includes(role));
    });
}

function canUse(item) {
    if (!item.dataset.roles) return true;
    return item.dataset.roles.split(",").map(r => r.trim()).includes(currentRole);
}

function showView(viewName, item) {
    if (item && !canUse(item)) return;

    document.querySelectorAll(".content-pane").forEach(p => p.classList.add("hidden"));
    const pane = $("view-" + viewName);
    if (pane) pane.classList.remove("hidden");

    document.querySelectorAll(".tool-item").forEach(t => t.classList.remove("active"));
    const target = item || toolList.querySelector(`[data-view="${viewName}"]`);
    if (target) target.classList.add("active");

    if (viewName === "placeholder" && item && placeholderTitle) {
        placeholderTitle.innerText = item.dataset.title || item.innerText;
    }
    if (viewName === "settings") loadUsers();
    if (viewName === "mail") showMailView();
}

/* =========================================================
   LOGIN / LOGOUT / AUTH-STATUS
   ========================================================= */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        currentUser = null;
        currentRole = "student";
        stopMail();
        stopGroups();
        loginView.classList.remove("hidden");
        dashboardView.classList.add("hidden");
        return;
    }

    const config = await loadSchoolConfig();
    const { role, assigned } = await loadUserRole(user.email);

    // Wartungsmodus: nur Admins dürfen rein
    if (config.maintenanceMode && role !== "admin") {
        setStatus(messageText, "🚨 Die Plattform befindet sich aktuell in planmäßigen Wartungsarbeiten. Login gesperrt.", "orange");
        signOut(auth);
        return;
    }

    currentUser = user;
    currentRole = role;

    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");

    userDisplayName.innerText = user.email;
    const hint = assigned ? "" : " (keine Rolle zugewiesen)";
    userPath.innerText = `${user.email} | [${ROLES[role]}]${hint} | ${globalSchoolName}`;

    applyRoleUI(role);
    startMail();
    startGroups();

    if (role === "admin") {
        settingsSchoolName.value = globalSchoolName;
        settingsMaintenance.checked = config.maintenanceMode;
    }

    showView("start");
});

loginBtn.addEventListener("click", () => {
    setStatus(messageText, "", "");
    signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value)
        .catch((error) => {
            if (error.code === "auth/invalid-credential") {
                setStatus(messageText, "E-Mail oder Passwort falsch.", "red");
            } else {
                setStatus(messageText, "Fehler: " + error.message, "red");
            }
        });
});

// Enter-Taste löst Login aus
[emailInput, passwordInput].forEach(el =>
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") loginBtn.click(); })
);

logoutBtn.addEventListener("click", () => signOut(auth));

/* =========================================================
   NAVIGATION
   ========================================================= */
// Klick auf ein Werkzeug in der Seitenleiste
toolList.addEventListener("click", (e) => {
    const item = e.target.closest(".tool-item");
    if (!item || !item.dataset.view) return;
    showView(item.dataset.view, item);
});

// "0 ungelesene E-Mails" auf der Startseite öffnet den Mail-Bereich
$("mail-summary-link").addEventListener("click", (e) => {
    e.preventDefault();
    showView("mail");
});

// Raum-Dropdown
roomBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    roomDropdown.classList.toggle("hidden");
});
document.addEventListener("click", () => roomDropdown.classList.add("hidden"));

schoolSelectBtn.addEventListener("click", () => {
    roomDropdown.classList.add("hidden");
    showView("start");
});

/* =========================================================
   ADMIN: GRUNDEINSTELLUNGEN
   ========================================================= */
saveSettingsBtn.addEventListener("click", async () => {
    setStatus(settingsMessage, "", "");
    if (currentRole !== "admin") return;

    try {
        await setDoc(doc(db, "config", "global"), {
            schoolName: settingsSchoolName.value.trim() || DEFAULT_SCHOOL_NAME,
            maintenanceMode: settingsMaintenance.checked
        }, { merge: true });

        await loadSchoolConfig();
        setStatus(settingsMessage, "✓ Einstellungen erfolgreich gespeichert!", "green");
    } catch (e) {
        setStatus(settingsMessage, "Fehler beim Speichern: " + e.message, "red");
    }
});

/* =========================================================
   ADMIN: BENUTZER & ROLLEN
   ========================================================= */
async function loadUsers() {
    if (currentRole !== "admin") return;
    usersTbody.innerHTML = "";

    try {
        const snap = await getDocs(collection(db, "users"));
        if (snap.empty) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 4;
            td.className = "muted";
            td.innerText = "Noch keine Benutzer mit Rolle eingetragen.";
            tr.appendChild(td);
            usersTbody.appendChild(tr);
            return;
        }

        const rows = [];
        snap.forEach(d => rows.push({ email: d.id, role: d.data().role, name: d.data().name || "" }));
        rows.sort((a, b) => a.email.localeCompare(b.email));

        rows.forEach(({ email, role, name }) => {
            const tr = document.createElement("tr");

            const tdMail = document.createElement("td");
            tdMail.innerText = email;

            const tdName = document.createElement("td");
            tdName.innerText = name;

            const tdRole = document.createElement("td");
            tdRole.innerText = ROLES[role] || `Unbekannt (${role})`;

            const tdAction = document.createElement("td");
            const delBtn = document.createElement("button");
            delBtn.className = "btn-small";
            delBtn.innerText = "Entfernen";
            delBtn.addEventListener("click", () => removeRole(email));
            tdAction.appendChild(delBtn);

            tr.append(tdMail, tdName, tdRole, tdAction);
            usersTbody.appendChild(tr);
        });
    } catch (e) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.style.color = "red";
        td.innerText = "Fehler beim Laden: " + e.message;
        tr.appendChild(td);
        usersTbody.appendChild(tr);
    }
}

saveRoleBtn.addEventListener("click", async () => {
    setStatus(roleMessage, "", "");
    if (currentRole !== "admin") return;

    const email = roleEmail.value.trim().toLowerCase();
    const role = roleSelect.value;

    if (!email || !email.includes("@")) {
        setStatus(roleMessage, "Bitte eine gültige E-Mail-Adresse eingeben.", "red");
        return;
    }
    if (!ROLES[role]) {
        setStatus(roleMessage, "Ungültige Rolle.", "red");
        return;
    }
    // Schutz: sich nicht versehentlich selbst degradieren
    if (email === currentUser.email.toLowerCase() && role !== "admin") {
        if (!confirm("Du entziehst dir selbst die Admin-Rechte. Wirklich fortfahren?")) return;
    }

    try {
        const userData = { role };
        const name = roleName.value.trim();
        if (name) userData.name = name;
        await setDoc(doc(db, "users", email), userData, { merge: true });
        setStatus(roleMessage, `✓ ${email} ist jetzt: ${ROLES[role]}`, "green");
        roleEmail.value = "";
        roleName.value = "";
        loadUsers();
    } catch (e) {
        setStatus(roleMessage, "Fehler beim Speichern: " + e.message, "red");
    }
});

async function removeRole(email) {
    if (email === currentUser.email.toLowerCase()) {
        setStatus(roleMessage, "Du kannst deinen eigenen Eintrag nicht entfernen.", "red");
        return;
    }
    if (!confirm(`Rolle von ${email} entfernen? Die Person gilt danach wieder als Schüler.`)) return;

    try {
        await deleteDoc(doc(db, "users", email));
        setStatus(roleMessage, `✓ Rolle von ${email} entfernt.`, "green");
        loadUsers();
    } catch (e) {
        setStatus(roleMessage, "Fehler beim Entfernen: " + e.message, "red");
    }
}
