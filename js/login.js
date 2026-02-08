import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyAD9gC8MPGCVP89xoFVkJWE0LKStxhCSeQ",
  authDomain: "tikets-e8747.firebaseapp.com",
  projectId: "tikets-e8747",
  storageBucket: "tikets-e8747.firebasestorage.app",
  messagingSenderId: "1011614009578",
  appId: "1:1011614009578:web:b18505cbd4b98e7a6d2f93",
  measurementId: "G-Z3HSTEH6JN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');
const forgotPasswordBtn = document.getElementById('forgotPassword');
const authMessage = document.getElementById('authMessage');

let isRegistering = false; // Bandera para controlar la redirección

// Verificar si ya hay sesión iniciada
onAuthStateChanged(auth, (user) => {
    if (user && !isRegistering) {
        window.location.href = 'index.html';
    }
});

btnLogin.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // La redirección la maneja onAuthStateChanged
    } catch (error) {
        showError(error);
    }
});

btnRegister.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    isRegistering = true; // Bloqueamos la redirección automática

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // --- CREAR DATOS POR DEFECTO ---
        const batch = writeBatch(db);
        
        const defaultZones = ["MADRID", "ALMENARA"];
        const defaultCategories = ["Alimentación", "Ropa", "Ocio", "Comunidades", "Seguros", "Otros"];

        defaultZones.forEach(zone => {
            const ref = doc(collection(db, "levels"));
            batch.set(ref, { name: zone, uid: user.uid });
        });

        defaultCategories.forEach(cat => {
            const ref = doc(collection(db, "categories"));
            batch.set(ref, { name: cat, uid: user.uid, color: "#007bff" });
        });

        await batch.commit();
        
        alert("Usuario creado correctamente. Iniciando sesión...");
        window.location.href = 'index.html'; // Redirigimos manualmente tras crear los datos
    } catch (error) {
        isRegistering = false; // Desbloqueamos si hubo error
        showError(error);
    }
});

forgotPasswordBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!email) {
        alert("Por favor, escribe tu email en la casilla de arriba para enviarte el enlace de recuperación.");
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        alert(`Se ha enviado un correo de recuperación a ${email}. Revisa tu bandeja de entrada.`);
    } catch (error) {
        showError(error);
    }
});

function showError(error) {
    console.error(error);
    let msg = "Error desconocido";
    if (error.code === 'auth/invalid-email') msg = "Email no válido.";
    if (error.code === 'auth/user-not-found') msg = "Usuario no encontrado.";
    if (error.code === 'auth/wrong-password') msg = "Contraseña incorrecta.";
    if (error.code === 'auth/email-already-in-use') msg = "El email ya está registrado.";
    if (error.code === 'auth/weak-password') msg = "La contraseña debe tener al menos 6 caracteres.";
    
    authMessage.textContent = msg;
}
