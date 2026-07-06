import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

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

// DOM Elemente holen
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const messageText = document.getElementById("message");
const userDisplayName = document.getElementById("user-display-name");
const userPath = document.getElementById("user-path");

// Raum Wechseln & Menu Navigation
const roomBtn = document.getElementById("roomBtn");
const roomDropdown = document.getElementById("room-dropdown");
const schoolSelectBtn = document.getElementById("school-select-btn");
const viewStart = document.getElementById("view-start");
const viewSettings = document.getElementById("view-settings");
const menuStart = document.getElementById("menu-start");
const menuSettings = document.getElementById("menu-settings");

// Einstellungs-Formular Elemente
const settingsSchoolName = document.getElementById("settings-schoolname");
const settingsMaintenance = document.getElementById("settings-maintenance");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsMessage = document.getElementById("settings-message");

let globalSchoolName = "LernNetz Schule";

// Funktion zum Laden der globalen Schul-Konfiguration
async function loadSchoolConfig() {
    try {
        const configDoc = await getDoc(doc(db, "config", "global"));
        if (configDoc.exists()) {
            const data = configDoc.data();
            globalSchoolName = data.schoolName || "LernNetz Schule";
            
            // Setzt den geänderten Schulnamen überall im HTML gleichzeitig ein
            document.querySelectorAll(".current-school-name").forEach(el => el.innerText = globalSchoolName);
            return data;
        }
    } catch (e) {
        console.error("Fehler beim Laden der Konfiguration:", e);
    }
    return { schoolName: "LernNetz Schule", maintenanceMode: false };
}

// Prüft Authentifizierung & Berechtigung live
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const config = await loadSchoolConfig();
        
        let userRole = "student";
        try {
            const userDoc = await getDoc(doc(db, "users", user.email.toLowerCase()));
            if (userDoc.exists()) {
                userRole = userDoc.data().role || "student";
            }
        } catch (e) { console.error(e); }

        // WARTUNGSMODUS-CHECK
        if (config.maintenanceMode && userRole !== "admin") {
            if (messageText) {
                messageText.innerText = "🚨 Die Plattform befindet sich aktuell in planmäßigen Wartungsarbeiten. Login gesperrt.";
                messageText.style.color = "orange";
            }
            signOut(auth);
            return;
        }

        if (loginView) loginView.classList.add("hidden");
        if (dashboardView) dashboardView.classList.remove("hidden");
        if (userDisplayName) userDisplayName.innerText = user.email;

        // Rollensteuerung fürs Menü
        if (userRole === "admin") {
            if (userPath) userPath.innerText = `${user.email} | [Administrator] | ${globalSchoolName}`;
            if (menuSettings) menuSettings.classList.remove("hidden");
            if (settingsSchoolName) settingsSchoolName.value = globalSchoolName;
            if (settingsMaintenance) settingsMaintenance.checked = config.maintenanceMode || false;
        } else if (userRole === "teacher") {
            if (userPath) userPath.innerText = `${user.email} | [Lehrer] | ${globalSchoolName}`;
            if (menuSettings) menuSettings.classList.add("hidden");
        } else {
            if (userPath) userPath.innerText = `${user.email} | [Schüler] | ${globalSchoolName}`;
            if (menuSettings) menuSettings.classList.add("hidden");
        }

    } else {
        if (loginView) loginView.classList.remove("hidden");
        if (dashboardView) dashboardView.classList.add("hidden");
    }
});

// LOGIN EVENT
if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        if (messageText) messageText.innerText = "";
        signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
            .catch((error) => {
                if (messageText) {
                    messageText.style.color = "red";
                    if (error.code === "auth/invalid-credential") {
                        messageText.innerText = "E-Mail oder Passwort falsch.";
                    } else {
                        messageText.innerText = "Fehler: " + error.message;
                    }
                }
            });
    });
}

// LOGOUT EVENT
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth);
    });
}

// SEITENWECHSEL: Klick auf Startseite
if (menuStart) {
    menuStart.addEventListener("click", () => {
        if (menuSettings) menuSettings.classList.remove("active");
        menuStart.add("active");
        if (viewSettings) viewSettings.classList.add("hidden");
        if (viewStart) viewStart.classList.remove("hidden");
    });
}

// SEITENWECHSEL: Klick auf Grundeinstellungen
if (menuSettings) {
    menuSettings.addEventListener("click", () => {
        if (menuStart) menuStart.classList.remove("active");
        menuSettings.classList.add("active");
        if (viewStart) viewStart.classList.add("hidden");
        if (viewSettings) viewSettings.classList.remove("hidden");
    });
}

// DROPDOWN "RAUM WECHSELN" ÖFFNEN / SCHLIESSEN
if (roomBtn) {
    roomBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (roomDropdown) roomDropdown.classList.toggle("hidden");
    });
}

document.addEventListener("click", () => {
    if (roomDropdown) roomDropdown.classList.add("hidden");
});

// KLICK AUF DIE SCHULE IM OVERLAY (Wechselt direkt zur Schulansicht/Klassenliste)
if (schoolSelectBtn) {
    schoolSelectBtn.addEventListener("click", () => {
        if (roomDropdown) roomDropdown.classList.add("hidden");
        if (menuSettings) menuSettings.classList.remove("active");
        if (menuStart) menuStart.classList.add("active");
        if (viewSettings) viewSettings.classList.add("hidden");
        if (viewStart) viewStart.classList.remove("hidden"); // Aktiviert die Klassenansicht
    });
}

// ADMIN EVENT: Grundeinstellungen speichern
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", async () => {
        if (settingsMessage) settingsMessage.innerText = "";
        try {
            await setDoc(doc(db, "config", "global"), {
                schoolName: settingsSchoolName ? settingsSchoolName.value : "LernNetz Schule",
                maintenanceMode: settingsMaintenance ? settingsMaintenance.checked : false
            }, { merge: true });
            
            if (settingsMessage) {
                settingsMessage.style.color = "green";
                settingsMessage.innerText = "✓ Einstellungen erfolgreich live gespeichert!";
            }
            
            await loadSchoolConfig();
        } catch (e) {
            if (settingsMessage) {
                settingsMessage.style.color = "red";
                settingsMessage.innerText = "Fehler beim Speichern: " + e.message;
            }
        }
    });
}
