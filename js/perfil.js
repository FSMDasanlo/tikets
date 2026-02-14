import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
let currentUser = null;

// --- FUNCIÓN DE CONFIRMACIÓN PERSONALIZADA ---
function showCustomConfirm(message) {
    return new Promise((resolve) => {
        let modal = document.getElementById('customConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'customConfirmModal';
            modal.className = 'modal-overlay';
            modal.style.zIndex = '9998';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <h3 style="margin-top: 0; color: #333; margin-bottom: 15px;">Confirmación</h3>
                    <p id="confirmMessage" style="color: #666; margin-bottom: 25px; font-size: 1.1rem;"></p>
                    <div class="modal-actions" style="justify-content: center; gap: 15px;">
                        <button id="confirmBtnYes" class="btn-save" style="background-color: #dc3545; width: auto; margin: 0; min-width: 100px;">Sí</button>
                        <button id="confirmBtnNo" class="btn-close" style="background-color: #6c757d; width: auto; margin: 0; min-width: 100px;">No</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const msgElement = document.getElementById('confirmMessage');
        const btnYes = document.getElementById('confirmBtnYes');
        const btnNo = document.getElementById('confirmBtnNo');

        msgElement.innerHTML = message.replace(/\n/g, '<br>');
        
        // 1. Mostrar modal
        modal.style.display = 'flex';
        
        // 2. Forzar reflow
        void modal.offsetWidth;
        
        // 3. Animar entrada
        modal.classList.add('show');

        const newBtnYes = btnYes.cloneNode(true);
        const newBtnNo = btnNo.cloneNode(true);
        btnYes.parentNode.replaceChild(newBtnYes, btnYes);
        btnNo.parentNode.replaceChild(newBtnNo, btnNo);

        // 4. Enfocar botón Sí
        newBtnYes.focus();

        const closeModal = (result) => {
            modal.classList.remove('show');
            setTimeout(() => { modal.style.display = 'none'; resolve(result); }, 300);
        };

        newBtnYes.addEventListener('click', () => closeModal(true));
        newBtnNo.addEventListener('click', () => closeModal(false));
    });
}

const userEmailSpan = document.getElementById('userEmail');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const btnUpdatePassword = document.getElementById('btnUpdatePassword');
const btnExportData = document.getElementById('btnExportData');
const btnImportData = document.getElementById('btnImportData');
const importFileInput = document.getElementById('importFileInput');
const btnDeleteAccount = document.getElementById('btnDeleteAccount');
const headerUserDisplay = document.getElementById('headerUserDisplay');

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userEmailSpan.textContent = user.email;
        if(headerUserDisplay) headerUserDisplay.textContent = `Usuario: ${user.email}`;
    } else {
        window.location.href = 'login.html';
    }
});

// --- CAMBIAR CONTRASEÑA ---
btnUpdatePassword.addEventListener('click', async () => {
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;

    if (newPass.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    if (newPass !== confirmPass) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    try {
        btnUpdatePassword.disabled = true;
        btnUpdatePassword.textContent = "Actualizando...";
        
        await updatePassword(currentUser, newPass);
        
        alert("✅ Contraseña actualizada correctamente.");
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        if (error.code === 'auth/requires-recent-login') {
            alert("⚠️ Por seguridad, esta operación requiere que hayas iniciado sesión recientemente.\n\nPor favor, cierra sesión y vuelve a entrar para intentarlo de nuevo.");
        } else {
            alert("Error: " + error.message);
        }
    } finally {
        btnUpdatePassword.disabled = false;
        btnUpdatePassword.textContent = "Actualizar Contraseña";
    }
});

// --- EXPORTAR DATOS ---
if (btnExportData) {
    btnExportData.addEventListener('click', async () => {
        try {
            btnExportData.disabled = true;
            btnExportData.textContent = "Exportando...";

            const data = {
                expenses: [],
                levels: [],
                categories: [],
                exportDate: new Date().toISOString(),
                userEmail: currentUser.email
            };

            // 1. Obtener Gastos
            const expensesSnap = await getDocs(query(collection(db, "expenses"), where("uid", "==", currentUser.uid)));
            expensesSnap.forEach(doc => data.expenses.push({ id: doc.id, ...doc.data() }));

            // 2. Obtener Zonas
            const levelsSnap = await getDocs(query(collection(db, "levels"), where("uid", "==", currentUser.uid)));
            levelsSnap.forEach(doc => data.levels.push({ id: doc.id, ...doc.data() }));

            // 3. Obtener Categorías
            const catsSnap = await getDocs(query(collection(db, "categories"), where("uid", "==", currentUser.uid)));
            catsSnap.forEach(doc => data.categories.push({ id: doc.id, ...doc.data() }));

            // 4. Crear archivo JSON
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_gastos_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`✅ Exportación completada.\nSe han descargado ${data.expenses.length} gastos, ${data.levels.length} zonas y ${data.categories.length} categorías.`);

        } catch (error) {
            console.error("Error exportando:", error);
            alert("Error al exportar datos: " + error.message);
        } finally {
            btnExportData.disabled = false;
            btnExportData.textContent = "Exportar Datos";
        }
    });
}

// --- IMPORTAR DATOS ---
if (btnImportData && importFileInput) {
    btnImportData.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!(await showCustomConfirm("⚠️ ATENCIÓN: Al importar, se añadirán los datos del archivo a tu cuenta.\nSi ya existen registros con el mismo ID, se actualizarán.\n\n¿Quieres continuar?"))) {
            importFileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                // Validar estructura básica
                if (!data.expenses || !data.levels || !data.categories) {
                    throw new Error("El archivo no tiene el formato correcto de copia de seguridad.");
                }

                btnImportData.disabled = true;
                btnImportData.textContent = "Restaurando...";

                // Firestore tiene un límite de 500 operaciones por batch.
                // Procesaremos en lotes de 450 para estar seguros.
                const batchSize = 450;
                let batch = writeBatch(db);
                let count = 0;
                let totalImported = 0;

                const processItem = async (collectionName, item) => {
                    // Usamos setDoc con el ID original para evitar duplicados si se importa dos veces
                    const ref = doc(db, collectionName, item.id);
                    // Aseguramos que el UID sea el del usuario actual (por si importamos backup de otro usuario)
                    const itemData = { ...item, uid: currentUser.uid };
                    
                    batch.set(ref, itemData);
                    count++;
                    totalImported++;

                    if (count >= batchSize) {
                        await batch.commit();
                        batch = writeBatch(db);
                        count = 0;
                    }
                };

                // Procesar todas las colecciones
                for (const item of data.expenses) await processItem('expenses', item);
                for (const item of data.levels) await processItem('levels', item);
                for (const item of data.categories) await processItem('categories', item);

                // Commit final si queda algo pendiente
                if (count > 0) await batch.commit();

                alert(`✅ Restauración completada con éxito.\nSe han procesado ${totalImported} registros.`);
                location.reload();

            } catch (error) {
                console.error("Error importando:", error);
                alert("Error al importar el archivo: " + error.message);
            } finally {
                btnImportData.disabled = false;
                btnImportData.textContent = "Importar / Restaurar JSON";
                importFileInput.value = '';
            }
        };
        reader.readAsText(file);
    });
}

// --- ELIMINAR CUENTA ---
btnDeleteAccount.addEventListener('click', async () => {
    if (!(await showCustomConfirm("⚠️ ¿ESTÁS SEGURO?\n\nEsta acción eliminará tu cuenta y TODOS tus datos permanentemente."))) return;

    if (!(await showCustomConfirm("⚠️ ÚLTIMA ADVERTENCIA\n\nNo podrás recuperar nada. ¿Confirmas el borrado?"))) return;

    try {
        btnDeleteAccount.disabled = true;
        btnDeleteAccount.textContent = "Borrando datos...";

        // 1. Borrar datos de Firestore (Gastos, Categorías, Zonas)
        const collections = ['expenses', 'levels', 'categories'];
        
        for (const colName of collections) {
            const q = query(collection(db, colName), where("uid", "==", currentUser.uid));
            const snapshot = await getDocs(q);
            
            // Borramos uno a uno (para simplificar, aunque batch es más eficiente para muchos datos)
            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
        }

        // 2. Borrar usuario de Auth
        btnDeleteAccount.textContent = "Eliminando usuario...";
        await deleteUser(currentUser);

        alert("Tu cuenta ha sido eliminada correctamente. Hasta pronto.");
        window.location.href = 'login.html';

    } catch (error) {
        console.error("Error al eliminar cuenta:", error);
        if (error.code === 'auth/requires-recent-login') {
            alert("⚠️ Por seguridad, para eliminar tu cuenta necesitas haber iniciado sesión recientemente.\n\nPor favor, cierra sesión, vuelve a entrar e inténtalo de nuevo inmediatamente.");
        } else {
            alert("Error al eliminar la cuenta: " + error.message);
        }
        btnDeleteAccount.disabled = false;
        btnDeleteAccount.textContent = "Eliminar Cuenta";
    }
});