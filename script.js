import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

// Deine echten Firebase-Daten
const firebaseConfig = {
    apiKey: "AIzaSyBJDxfrc0YamrkoTlSY8H8TTzjBVvGNYXg",
    authDomain: "lernnetz-3e076.firebaseapp.com",
    projectId: "lernnetz-3e076",
    storageBucket: "lernnetz-3e076.firebasestorage.app",
    messagingSenderId: "916848257433",
    appId: "1:916848257433:web:34eb4158a832a69bf48b08",
    measurementId: "G-NBESQV0SHS"
};

// Firebase & Firestore starten
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML Elemente greifen
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const messageText = document.getElementById("message");
const userDisplayName = document.getElementById("user-display-name");
const userPath = document.getElementById("user-path");

// Rollen-Inhalte greifen
const adminPanel = document.getElementById("admin-panel");
const teacherPanel = document.getElementById("teacher-panel");

// AUTOMATISCHE PRÜFUNG: Ist der Nutzer eingeloggt?
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginView.classList.add("hidden");
        dashboardView.classList.remove("hidden");
        messageText.innerText = "";
        userDisplayName.innerText = user.email;
        
        // Standardmäßig alle Rollen-Panels verstecken
        adminPanel.classList.add("hidden");
        teacherPanel.classList.add("hidden");

        try {
            // Hole die Rolle aus Firestore (Sammlung "users", Dokumenten-ID ist die E-Mail)
            const userDocRef = doc(db, "users", user.email.toLowerCase());
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const role = userData.role; // 'admin', 'teacher' oder 'student'

                if (role === "admin") {
                    userPath.innerText = user.email + " | [Administrator]";
                    adminPanel.classList.remove("hidden");
                } else if (role === "teacher") {
                    userPath.innerText = user.email + " | [Lehrer]";
                    teacherPanel.classList.remove("hidden");
                } else {
                    userPath.innerText = user.email + " | [Schüler]";
                }
            } else {
                // Falls kein Datenbankeintrag existiert, ist es standardmäßig ein Schüler
                userPath.innerText = user.email + " | [Schüler (Kein Profil)]";
            }
        } catch (error) {
            console.error("Fehler beim Laden der Rolle:", error);
            userPath.innerText = user.email + " | Rolle konnte nicht geladen werden";
        }

    } else {
        loginView.classList.remove("hidden");
        dashboardView.classList.add("hidden");
    }
});

// FUNKTION: Einloggen
loginBtn.addEventListener("click", () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            messageText.style.color = "red";
            if (error.code === "auth/invalid-credential") {
                messageText.innerText = "E-Mail oder Passwort falsch.";
            } else {
                messageText.innerText = "Fehler: " + error.message;
            }
        });
});

// FUNKTION: Ausloggen
logoutBtn.addEventListener("click", () => {
    signOut(auth);
});
