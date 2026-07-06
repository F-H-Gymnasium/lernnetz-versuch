import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

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

// Firebase starten
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// HTML Elemente greifen
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const messageText = document.getElementById("message");

// AUTOMATISCHE PRÜFUNG: Ist der Nutzer eingeloggt?
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginView.classList.add("hidden");
        dashboardView.classList.remove("hidden");
        messageText.innerText = "";
    } else {
        loginView.classList.remove("hidden");
        dashboardView.classList.add("hidden");
    }
});

// FUNKTION: Einloggen
loginBtn.addEventListener("click", () => {
    console.log("Button wurde geklickt!"); // Test 1: Reagiert der Button?
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    console.log("Versuche Login für:", email); // Test 2: Werden die Daten ausgelesen?

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            console.log("Erfolgreich eingeloggt!", userCredential.user);
        })
        .catch((error) => {
            console.error("Firebase Fehler:", error); // Zeigt den echten Fehler in F12 an
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
