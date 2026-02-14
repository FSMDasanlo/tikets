import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

console.log("🚀 Iniciando script de ingresos...");

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAD9gC8MPGCVP89xoFVkJWE0LKStxhCSeQ",
  authDomain: "tikets-e8747.firebaseapp.com",
  projectId: "tikets-e8747",
  storageBucket: "tikets-e8747.firebasestorage.app",
  messagingSenderId: "1011614009578",
  appId: "1:1011614009578:web:b18505cbd4b98e7a6d2f93",
  measurementId: "G-Z3HSTEH6JN"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let currentUser = null;
let currentIncomesData = []; // Almacenar datos cargados para edición

// Elementos DOM - Añadir
const addDate = document.getElementById('addDate');
const addBank = document.getElementById('addBank');
const addConcept = document.getElementById('addConcept');
const addAmount = document.getElementById('addAmount');
const btnAddIncome = document.getElementById('btnAddIncome');

// Elementos DOM - Consultar
const filterDateStart = document.getElementById('filterDateStart');
const filterDateEnd = document.getElementById('filterDateEnd');
const filterBank = document.getElementById('filterBank');
const filterConcept = document.getElementById('filterConcept');
const btnSearch = document.getElementById('btnSearch');
const btnClear = document.getElementById('btnClear');
const incomeTableBody = document.querySelector('#incomeTable tbody');
const totalIncomeSpan = document.getElementById('totalIncome');

// Elementos DOM - Modal Edición
const editIncomeModal = document.getElementById('editIncomeModal');
const editIncomeTitle = document.getElementById('editIncomeTitle');
const editIncomeId = document.getElementById('editIncomeId');
const editIncomeDate = document.getElementById('editIncomeDate');
const editIncomeBank = document.getElementById('editIncomeBank');
const editIncomeConcept = document.getElementById('editIncomeConcept');
const editIncomeAmount = document.getElementById('editIncomeAmount');
const saveIncomeEditBtn = document.getElementById('saveIncomeEditBtn');
const closeIncomeEditBtn = document.getElementById('closeIncomeEditBtn');

// Autenticación
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("✅ Usuario autenticado:", user.email);
        currentUser = user;
        const headerUserDisplay = document.getElementById('headerUserDisplay');
        if(headerUserDisplay) headerUserDisplay.textContent = `Usuario: ${user.email}`;
        
        // Establecer fecha de hoy por defecto en añadir si está vacío
        if (addDate && !addDate.value) {
            addDate.value = new Date().toISOString().split('T')[0];
        }
        
        // Cargar datos iniciales
        searchIncomes(); 
        loadIncomeSuggestions(); // Cargar sugerencias para autocompletar
    } else {
        console.warn("⚠️ No hay usuario, redirigiendo...");
        window.location.href = 'login.html';
    }
});

// --- FUNCIÓN 1: AÑADIR INGRESO ---
if (btnAddIncome) {
    btnAddIncome.addEventListener('click', async () => {
        console.log("🖱️ Botón 'Guardar Ingreso' pulsado");

        if (!currentUser) {
            alert("Error: No hay usuario identificado.");
            return;
        }

        const date = addDate.value;
        const bank = addBank.value.trim();
        const concept = addConcept.value.trim();
        const amount = parseFloat(addAmount.value);

        if (!date || !bank || !concept || isNaN(amount)) {
            alert("⚠️ Por favor, rellena todos los campos correctamente (Fecha, Banco, Concepto e Importe).");
            return;
        }

        try {
            btnAddIncome.disabled = true;
            btnAddIncome.textContent = "Guardando...";

            console.log("💾 Guardando en Firestore...", { date, bank, concept, amount });

            await addDoc(collection(db, "incomes"), {
                uid: currentUser.uid,
                date: date,
                bank: bank,
                concept: concept,
                amount: amount,
                createdAt: new Date()
            });

            console.log("✅ Guardado exitoso");
            alert("✅ ¡Ingreso guardado correctamente en la base de datos!");
            
            // Limpiar campos
            addBank.value = '';
            addConcept.value = '';
            addAmount.value = '';
            
            // Limpiar filtros para ver el nuevo registro
            clearFilterFields();
            
            // Recargar tabla
            searchIncomes();
            loadIncomeSuggestions(); // Recargar sugerencias por si hay nuevos valores

        } catch (error) {
            console.error("❌ Error al guardar ingreso:", error);
            alert("❌ Error al guardar: " + error.message);
        } finally {
            btnAddIncome.disabled = false;
            btnAddIncome.textContent = "Guardar Ingreso";
        }
    });
} else {
    console.error("❌ Error crítico: No se encontró el botón 'btnAddIncome' en el HTML.");
}

// --- FUNCIÓN 2: CONSULTAR INGRESOS ---
async function searchIncomes() {
    if (!currentUser) return;

    console.log("🔍 Buscando ingresos...");
    incomeTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando datos...</td></tr>';
    totalIncomeSpan.textContent = 'Total: ...';

    try {
        const q = query(collection(db, "incomes"), where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        let incomes = [];
        querySnapshot.forEach((doc) => {
            incomes.push({ id: doc.id, ...doc.data() });
        });
        currentIncomesData = incomes; // Guardar referencia global

        // Aplicar Filtros
        const fDateStart = filterDateStart ? filterDateStart.value : '';
        const fDateEnd = filterDateEnd ? filterDateEnd.value : '';
        const fBank = filterBank ? filterBank.value.toLowerCase().trim() : '';
        const fConcept = filterConcept ? filterConcept.value.toLowerCase().trim() : '';

        const filteredIncomes = incomes.filter(item => {
            if (fDateStart && item.date < fDateStart) return false;
            if (fDateEnd && item.date > fDateEnd) return false;
            if (fBank && !item.bank.toLowerCase().includes(fBank)) return false;
            if (fConcept && !item.concept.toLowerCase().includes(fConcept)) return false;
            return true;
        });

        // Ordenar por fecha descendente
        filteredIncomes.sort((a, b) => new Date(b.date) - new Date(a.date));

        renderTable(filteredIncomes);

    } catch (error) {
        console.error("Error consultando ingresos:", error);
        incomeTableBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error: ${error.message}</td></tr>`;
    }
}

function renderTable(data) {
    incomeTableBody.innerHTML = '';
    let total = 0;

    if (data.length === 0) {
        incomeTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #777;">No se encontraron ingresos.</td></tr>';
        totalIncomeSpan.textContent = 'Total: 0.00 €';
        return;
    }

    data.forEach(item => {
        const amount = parseFloat(item.amount) || 0;
        total += amount;

        // Formatear fecha DD-MM-YYYY
        let displayDate = item.date;
        if (displayDate && displayDate.includes('-')) {
            const [y, m, d] = displayDate.split('-');
            displayDate = `${d}-${m}-${y}`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${displayDate}</td>
            <td>${item.bank}</td>
            <td>${item.concept}</td>
            <td style="text-align: right; font-weight: bold; color: #28a745;">${amount.toFixed(2)} €</td>
            <td style="text-align: center;">
                <button class="action-btn btn-duplicate" data-id="${item.id}" style="background-color: #28a745; padding: 5px 10px; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 5px;" title="Duplicar">📄</button>
                <button class="action-btn btn-edit" data-id="${item.id}" style="background-color: #ffc107; color: #333; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Editar">✏️</button>
                <button class="action-btn btn-delete" data-id="${item.id}" style="background-color: #dc3545; padding: 5px 10px; border: none; border-radius: 4px; color: white; cursor: pointer;" title="Borrar">🗑️</button>
            </td>
        `;
        incomeTableBody.appendChild(row);
    });

    totalIncomeSpan.textContent = `Total: ${total.toFixed(2)} €`;

    // Eventos de botones
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => deleteIncome(e.target.closest('button').dataset.id));
    });
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => openEditModal(e.target.closest('button').dataset.id));
    });
    document.querySelectorAll('.btn-duplicate').forEach(btn => {
        btn.addEventListener('click', (e) => openDuplicateModal(e.target.closest('button').dataset.id));
    });
}

// --- FUNCIÓN 3: BORRAR INGRESO ---
async function deleteIncome(id) {
    if (confirm("¿Estás seguro de que quieres eliminar este ingreso?")) {
        try {
            await deleteDoc(doc(db, "incomes", id));
            alert("Registro eliminado.");
            searchIncomes(); // Recargar tabla
        } catch (error) {
            console.error("Error al borrar:", error);
            alert("Error al borrar: " + error.message);
        }
    }
}

// --- FUNCIÓN: ABRIR MODAL EDICIÓN ---
function openEditModal(id) {
    const item = currentIncomesData.find(i => i.id === id);
    if (!item) return;

    editIncomeTitle.textContent = "Editar Ingreso";
    saveIncomeEditBtn.textContent = "Guardar Cambios";
    
    editIncomeId.value = id;
    editIncomeDate.value = item.date;
    editIncomeBank.value = item.bank;
    editIncomeConcept.value = item.concept;
    editIncomeAmount.value = item.amount;

    editIncomeModal.style.display = 'flex';
}

// --- FUNCIÓN: ABRIR MODAL DUPLICAR ---
function openDuplicateModal(id) {
    const item = currentIncomesData.find(i => i.id === id);
    if (!item) return;

    editIncomeTitle.textContent = "Duplicar Ingreso";
    saveIncomeEditBtn.textContent = "Crear Nuevo Ingreso";
    
    editIncomeId.value = ""; // ID vacío indica creación
    editIncomeDate.value = item.date; // Mantiene fecha original (usuario puede cambiarla)
    editIncomeBank.value = item.bank;
    editIncomeConcept.value = item.concept;
    editIncomeAmount.value = item.amount;

    editIncomeModal.style.display = 'flex';
}

// --- LÓGICA GUARDAR MODAL ---
if (saveIncomeEditBtn) {
    saveIncomeEditBtn.addEventListener('click', async () => {
        const id = editIncomeId.value;
        const date = editIncomeDate.value;
        const bank = editIncomeBank.value.trim();
        const concept = editIncomeConcept.value.trim();
        const amount = parseFloat(editIncomeAmount.value);

        if (!date || !bank || !concept || isNaN(amount)) {
            alert("Por favor, rellena todos los campos.");
            return;
        }

        const data = {
            uid: currentUser.uid,
            date,
            bank,
            concept,
            amount
        };

        try {
            saveIncomeEditBtn.disabled = true;
            if (id) {
                // EDITAR
                await updateDoc(doc(db, "incomes", id), data);
                alert("✅ Ingreso actualizado.");
            } else {
                // DUPLICAR (CREAR)
                data.createdAt = new Date();
                await addDoc(collection(db, "incomes"), data);
                alert("✅ Nuevo ingreso creado.");
            }
            editIncomeModal.style.display = 'none';
            searchIncomes(); // Recargar tabla
            loadIncomeSuggestions(); // Actualizar autocompletar
        } catch (error) {
            console.error("Error guardando:", error);
            alert("Error: " + error.message);
        } finally {
            saveIncomeEditBtn.disabled = false;
        }
    });
}

if (closeIncomeEditBtn) {
    closeIncomeEditBtn.addEventListener('click', () => {
        editIncomeModal.style.display = 'none';
    });
}

// --- FUNCIÓN 4: CARGAR SUGERENCIAS (AUTOCOMPLETAR) ---
async function loadIncomeSuggestions() {
    if (!currentUser) return;
    const bankDatalist = document.getElementById('bankSuggestions');
    const conceptDatalist = document.getElementById('conceptSuggestions');
    
    // Si no existen los datalists en el DOM, salimos
    if (!bankDatalist || !conceptDatalist) return;

    try {
        const q = query(collection(db, "incomes"), where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        const banks = new Set();
        const concepts = new Set();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.bank) banks.add(data.bank.trim());
            if (data.concept) concepts.add(data.concept.trim());
        });

        // Rellenar Datalist Bancos
        bankDatalist.innerHTML = '';
        Array.from(banks).sort().forEach(bank => {
            const option = document.createElement('option');
            option.value = bank;
            bankDatalist.appendChild(option);
        });

        // Rellenar Datalist Conceptos
        conceptDatalist.innerHTML = '';
        Array.from(concepts).sort().forEach(concept => {
            const option = document.createElement('option');
            option.value = concept;
            conceptDatalist.appendChild(option);
        });

    } catch (error) {
        console.error("Error cargando sugerencias de ingresos:", error);
    }
}

function clearFilterFields() {
    if(filterDateStart) filterDateStart.value = '';
    if(filterDateEnd) filterDateEnd.value = '';
    if(filterBank) filterBank.value = '';
    if(filterConcept) filterConcept.value = '';
}

// Event Listeners Botones
if (btnSearch) btnSearch.addEventListener('click', searchIncomes);

if (btnClear) {
    btnClear.addEventListener('click', () => {
        clearFilterFields();
        searchIncomes();
    });
}