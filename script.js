import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

// TODO: Ersetze diese Daten mit deiner echten Firebase-Config aus der Firebase-Konsole!
const firebaseConfig = {
    apiKey: "AIzaSyBJDxfrc0YamrkoTlSY8H8TTzjBVvGNYXg",
    authDomain: "lernnetz-3e076.firebaseapp.com",
    projectId: "lernnetz-3e076",
    storageBucket: "lernnetz-3e076.firebasestorage.app",
    messagingSenderId: "916848257433",
    appId: "1:916848257433:web:34eb4158a832a69bf48b08",
    measurementId: "G-NBESQV0SHS"
  };

// Firebase starten
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// HTML Elemente greifen
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const messageText = document.getElementById("message");

// AUTOMATISCHE PRÜFUNG: Ist der Nutzer schon eingeloggt?
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Angemeldet -> Login verstecken, Dashboard zeigen
        loginView.classList.add("hidden");
        dashboardView.classList.remove("hidden");
        messageText.innerText = "";
    } else {
        // Abgemeldet -> Login zeigen, Dashboard verstecken
        loginView.classList.remove("hidden");
        dashboardView.classList.add("hidden");
    }
});

// FUNKTION: Registrieren
registerBtn.addEventListener("click", () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    createUserWithEmailAndPassword(auth, email, password)
        .then(() => {
            messageText.style.color = "green";
            messageText.innerText = "Konto erfolgreich erstellt!";
        })
        .catch((error) => {
            messageText.style.color = "red";
            messageText.innerText = "Fehler: " + error.message;
        });
});

// FUNKTION: Einloggen
loginBtn.addEventListener("click", () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            messageText.style.color = "red";
            messageText.innerText = "Login fehlgeschlagen: " + error.message;
        });
});

// FUNKTION: Ausloggen
logoutBtn.addEventListener("click", () => {
    signOut(auth);
});
