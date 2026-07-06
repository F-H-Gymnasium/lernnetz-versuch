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
const adminMenuTitle = document.getElementById("admin-menu-title");

// Einstellungs-Formular Elemente
const settingsSchoolName = document.getElementById("settings-schoolname");
const settingsMaintenance = document.getElementById("settings-maintenance");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const settingsMessage = document.getElementById("settings-message");

let globalSchoolName = "LernNetz Schule";

// Funktion zum Laden der globalen Schul-Konfiguration (Name & Wartung)
async function loadSchoolConfig() {
    try {
        const configDoc = await getDoc(doc(db, "config", "global"));
        if (configDoc.exists()) {
            const data = configDoc.data();
            globalSchoolName = data.schoolName || "LernNetz Schule";
            
            // Setze alle Namensanzeigen im HTML auf den geladenen Wert um
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
        
        // Erst Rolle des Nutzers ermitteln
        let userRole = "student";
        try {
            const userDoc = await getDoc(doc(db, "users", user.email.toLowerCase()));
            if (userDoc.exists()) {
                userRole = userDoc.data().role || "student";
            }
        } catch (e) { console.error(e); }

        // WARTUNGSMODUS-CHECK: Wenn aktiv und User kein Admin ist -> Direkt wieder ausloggen!
        if (config.maintenanceMode && userRole !== "admin") {
            messageText.innerText = "🚨 Die Plattform befindet sich aktuell in planmäßigen Wartungsarbeiten. Login gesperrt.";
            messageText.style.color = "orange";
            signOut(auth);
            return;
        }

        // GUI für eingeloggte User freischalten
        loginView.classList.add("hidden");
        dashboardView.classList.remove("hidden");
        userDisplayName.innerText = user.email;

        // Rollenspezifischer Pfadtext & Menü-Freischaltung
        if (userRole === "admin") {
            userPath.innerText = `${user.email} | [Administrator] | ${globalSchoolName}`;
            adminMenuTitle.classList.remove("hidden");
            menuSettings.classList.remove("hidden");
            
            // Vorbefüllung der Administrationsfelder
            settingsSchoolName.value = globalSchoolName;
            settingsMaintenance.checked = config.maintenanceMode || false;
        } else if (userRole === "teacher") {
            userPath.innerText = `${user.email} | [Lehrer] | ${globalSchoolName}`;
        } else {
            userPath.innerText = `${user.email} | [Schüler] | ${globalSchoolName}`;
        }

    } else {
        loginView.classList.remove("hidden");
        dashboardView.classList.add("hidden");
    }
});

// LOGIN EVENT
loginBtn.addEventListener("click", () => {
    messageText.innerText = "";
    signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
        .catch((error) => {
            messageText.style.color = "red";
            if (error.code === "auth/invalid-credential") {
                messageText.innerText = "E-Mail oder Passwort falsch.";
            } else {
                messageText.innerText = "Fehler: " + error.message;
            }
        });
});

// LOGOUT EVENT
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth);
    });
}

// PANE/VIEW WECHSEL LOGIK (Klick auf Menüpunkte)
menuStart.addEventListener("click", () => {
    menuSettings.classList.remove("active");
    menuStart.classList.add("active");
    viewSettings.classList.add("hidden");
    viewStart.classList.remove("hidden");
});

menuSettings.addEventListener("click", () => {
    menuStart.classList.remove("active");
    menuSettings.classList.add("active");
    viewStart.classList.add("hidden");
    viewSettings.classList.remove("hidden");
});

// DROPDOWN "RAUM WECHSELN" ÖFFNEN / SCHLIESSEN (Bild 4)
roomBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    roomDropdown.classList.toggle("hidden");
});

// Schließt das Menü, wenn man irgendwo anders hinklickt
document.addEventListener("click", () => {
    roomDropdown.classList.add("hidden");
});

// KLICK AUF SCHULE IM DROPDOWN (Wechselt zur Raum-Ansicht)
schoolSelectBtn.addEventListener("click", () => {
    roomDropdown.classList.add("hidden");
    menuSettings.classList.remove("active");
    menuStart.classList.add("active");
    viewSettings.classList.add("hidden");
    viewStart.classList.remove("hidden");
});

// ADMIN EVENT: Einstellungen in Firestore speichern
saveSettingsBtn.addEventListener("click", async () => {
    settingsMessage.innerText = "";
    try {
        await setDoc(doc(db, "config", "global"), {
            schoolName: settingsSchoolName.value,
            maintenanceMode: settingsMaintenance.checked
        }, { merge: true });
        
        settingsMessage.style.color = "green";
        settingsMessage.innerText = "✓ Einstellungen erfolgreich übernommen und gespeichert!";
        
        // Aktualisiere Werte direkt ohne Neuladen
        await loadSchoolConfig();
    } catch (e) {
        settingsMessage.style.color = "red";
        settingsMessage.innerText = "Fehler beim Speichern: " + e.message;
    }
});
