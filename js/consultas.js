import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, doc, deleteDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- CONFIGURACIÓN DE FIREBASE (Copiada de script.js) ---
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

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const headerUserDisplay = document.getElementById('headerUserDisplay');
        if(headerUserDisplay) headerUserDisplay.textContent = `Usuario: ${user.email}`;
        loadFilterOptions();
        loadConfig();
    } else {
        window.location.href = 'login.html';
    }
});

console.log("✅ Script consultas.js cargado y Firebase inicializado.");

// --- FUNCIÓN DE ALERTA PERSONALIZADA ---
function showCustomAlert(message, type = 'neutral') {
    let alertBox = document.getElementById('customAlert');
    if (!alertBox) {
        alertBox = document.createElement('div');
        alertBox.id = 'customAlert';
        alertBox.className = 'custom-alert';
        document.body.appendChild(alertBox);
    }
    alertBox.textContent = message;
    alertBox.className = 'custom-alert'; // Reset clases
    if (type === 'success') alertBox.classList.add('success');
    if (type === 'error') alertBox.classList.add('error');
    
    void alertBox.offsetWidth; // Forzar reflow
    alertBox.classList.add('show');
    setTimeout(() => alertBox.classList.remove('show'), 2000);
}

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
        
        // 1. Mostrar modal (display flex)
        modal.style.display = 'flex';
        
        // 2. Forzar reflow para que la transición CSS funcione
        void modal.offsetWidth;
        
        // 3. Añadir clase para animación de entrada
        modal.classList.add('show');

        const newBtnYes = btnYes.cloneNode(true);
        const newBtnNo = btnNo.cloneNode(true);
        btnYes.parentNode.replaceChild(newBtnYes, btnYes);
        btnNo.parentNode.replaceChild(newBtnNo, btnNo);

        // 4. Enfocar botón Sí automáticamente
        newBtnYes.focus();

        const closeModal = (result) => {
            modal.classList.remove('show'); // Iniciar animación salida
            setTimeout(() => { modal.style.display = 'none'; resolve(result); }, 300); // Esperar transición
        };

        newBtnYes.addEventListener('click', () => closeModal(true));
        newBtnNo.addEventListener('click', () => closeModal(false));
    });
}

// Elementos del DOM
const searchBtn = document.getElementById('searchBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn'); // Botón para limpiar filtros
const btnPrevMonth = document.getElementById('btnPrevMonth');
const btnCurrMonth = document.getElementById('btnCurrMonth');
const btnCurrYear = document.getElementById('btnCurrYear');
const resultsTableBody = document.querySelector('#resultsTable tbody');
const totalResultsSpan = document.getElementById('totalResults');
const totalIncomesSpan = document.getElementById('totalIncomes'); // Nuevo span para ingresos
const totalBalanceSpan = document.getElementById('totalBalance'); // Nuevo span para balance
const resultsTableHead = document.querySelector('#resultsTable thead');
const resultsTableFoot = document.querySelector('#resultsTable tfoot');
const btnViewTotal = document.getElementById('btnViewTotal');
const btnViewDetail = document.getElementById('btnViewDetail');
const btnViewAccounts = document.getElementById('btnViewAccounts');

let currentFilteredDocs = []; // Almacena los datos actuales para no re-consultar al cambiar vista
let originalFilteredDocs = []; // Copia de seguridad de los resultados de búsqueda para filtros locales (gráfico)
let currentFilteredIncomes = []; // Almacena los ingresos filtrados actuales
let currentTotalIncome = 0; // Variable global para almacenar el total de ingresos
let currentViewMode = 'detail'; // 'detail' o 'total'
let expenseChart = null; // Variable para el gráfico
let categoryColors = {}; // Mapa de colores por categoría
let sortState = { column: 'date', direction: 'desc' }; // Estado de ordenación

// Elementos del Modal de Edición
const editModalOverlay = document.getElementById('editModalOverlay');
const closeEditBtn = document.getElementById('closeEditBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const editModalTitle = document.getElementById('editModalTitle');

// Evento de ordenación en cabeceras
if (resultsTableHead) {
    resultsTableHead.addEventListener('click', (e) => {
        const th = e.target.closest('th');
        if (!th || !th.dataset.sort) return;
        
        const column = th.dataset.sort;
        if (sortState.column === column) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.column = column;
            sortState.direction = 'asc';
        }
        renderTable();
    });
}

// Evento para resaltar fila al hacer clic
resultsTableBody.addEventListener('click', (e) => {
    // Solo funciona en modo 'detalle'
    if (currentViewMode !== 'detail') return;

    const row = e.target.closest('tr');
    // Si no se hace clic en una fila (TR) o se hace en un botón, no hacer nada
    if (!row || e.target.closest('button')) return;

    // Si la fila ya está seleccionada, la deseleccionamos. Si no, la seleccionamos.
    if (row.classList.contains('row-selected')) {
        row.classList.remove('row-selected');
    } else {
        // Quitamos la selección de cualquier otra fila que la tuviera
        const selected = resultsTableBody.querySelector('.row-selected');
        if (selected) selected.classList.remove('row-selected');
        // Añadimos la selección a la fila actual
        row.classList.add('row-selected');
    }
});

// Función para cargar comercios y conceptos únicos en los desplegables
async function loadFilterOptions() {
    const merchantSelect = document.getElementById('filterMerchant');
    const productSelect = document.getElementById('filterProduct');
    const bankSelect = document.getElementById('filterBank');
    // Indicador de carga
    merchantSelect.innerHTML = '<option value="">Cargando...</option>';
    productSelect.innerHTML = '<option value="">Cargando...</option>';
    if (bankSelect) bankSelect.innerHTML = '<option value="">Cargando...</option>';

    try {
        // Solo cargar opciones de MIS gastos
        const querySnapshot = await getDocs(query(collection(db, "expenses"), where("uid", "==", currentUser.uid)));
        const merchants = new Set();
        const products = new Set();
        const banks = new Set();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.merchant) {
                merchants.add(data.merchant.trim());
            }
            if (data.bank) {
                banks.add(data.bank.trim());
            }
        });
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.product) {
                products.add(data.product.trim());
            }
        });

        const sortedMerchants = Array.from(merchants).sort();
        const sortedProducts = Array.from(products).sort();
        const sortedBanks = Array.from(banks).sort();

        merchantSelect.innerHTML = '<option value="">Todos</option>';
        sortedMerchants.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            merchantSelect.appendChild(option);
        });

        productSelect.innerHTML = '<option value="">Todos</option>';
        sortedProducts.forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            productSelect.appendChild(option);
        });

        if (bankSelect) {
            bankSelect.innerHTML = '<option value="">Todos</option>';
            sortedBanks.forEach(b => {
                const option = document.createElement('option');
                option.value = b;
                option.textContent = b;
                bankSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error cargando filtros:", error);
        merchantSelect.innerHTML = '<option value="">Error</option>';
        productSelect.innerHTML = '<option value="">Error</option>';
        if (bankSelect) bankSelect.innerHTML = '<option value="">Error</option>';
    }
}

// Función para cargar configuración (Zonas y Categorías)
async function loadConfig() {
    try {
        const levelsSnap = await getDocs(query(collection(db, "levels"), where("uid", "==", currentUser.uid)));
        const catsSnap = await getDocs(query(collection(db, "categories"), where("uid", "==", currentUser.uid)));

        // Elementos a rellenar
        const filterLevel = document.getElementById('filterLevel0');
        const filterCat = document.getElementById('filterCategory');
        const editLevel = document.getElementById('editLevel0');
        const editCat = document.getElementById('editCategory');

        // Rellenar Zonas
        if (!levelsSnap.empty) {
            // Guardar opción "Todos" para el filtro
            filterLevel.innerHTML = '<option value="">Todos</option>';
            editLevel.innerHTML = '';
            
            levelsSnap.forEach(doc => {
                const name = doc.data().name;
                filterLevel.innerHTML += `<option value="${name}">${name}</option>`;
                editLevel.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }

        // Rellenar Categorías
        if (!catsSnap.empty) {
            filterCat.innerHTML = '<option value="">Todas</option>';
            editCat.innerHTML = '';
            
            catsSnap.forEach(doc => {
                const name = doc.data().name;
                const color = doc.data().color;
                filterCat.innerHTML += `<option value="${name}">${name}</option>`;
                editCat.innerHTML += `<option value="${name}">${name}</option>`;
                
                if (color) {
                    categoryColors[name] = color;
                }
            });
        }

    } catch (e) {
        console.error("Error cargando configuración:", e);
    }
}

// Función principal de búsqueda
async function searchExpenses() {
    console.log("🔍 Iniciando búsqueda...");
    resultsTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">⏳ Cargando datos de la nube...</td></tr>';
    
    const level0 = document.getElementById('filterLevel0').value;
    const merchant = document.getElementById('filterMerchant').value;
    const product = document.getElementById('filterProduct').value;
    const category = document.getElementById('filterCategory').value;
    const bank = document.getElementById('filterBank').value;
    const dateStart = document.getElementById('filterDateStart').value;
    const dateEnd = document.getElementById('filterDateEnd').value;
    const showReturns = document.getElementById('filterReturns').checked;

    // --- CALCULAR INGRESOS (En base a fechas) ---
    if (totalIncomesSpan) {
        totalIncomesSpan.textContent = 'Ingresos: ...';
        if (totalBalanceSpan) totalBalanceSpan.textContent = 'Balance: ...';
        try {
            const qIncome = query(collection(db, "incomes"), where("uid", "==", currentUser.uid));
            const incomeSnap = await getDocs(qIncome);
            const allIncomes = [];
            let incomeTotal = 0;
            incomeSnap.forEach(doc => {
                const data = doc.data();
                if (dateStart && data.date < dateStart) return;
                if (dateEnd && data.date > dateEnd) return;
                incomeTotal += parseFloat(data.amount) || 0;
                allIncomes.push({ id: doc.id, ...doc.data() });
            });
            currentTotalIncome = incomeTotal;
            currentFilteredIncomes = allIncomes;
            totalIncomesSpan.textContent = `Ingresos: ${incomeTotal.toFixed(2)} €`;
        } catch (err) {
            console.error("Error calculando ingresos:", err);
            currentTotalIncome = 0;
            totalIncomesSpan.textContent = 'Ingresos: 0.00 €';
        }
    }

    try {
        let q = collection(db, "expenses");
        
        // ESTRATEGIA SEGURA: Filtrar SIEMPRE por UID en la nube.
        // Para evitar errores de índices complejos, traemos TODO lo del usuario
        // y filtramos el resto (Zona, Fecha, etc.) en JavaScript.
        q = query(q, where("uid", "==", currentUser.uid));

        const querySnapshot = await getDocs(q);
        console.log(`📡 Documentos recuperados de Firestore: ${querySnapshot.size}`);

        let docs = [];
        querySnapshot.forEach((doc) => {
            docs.push({ id: doc.id, ...doc.data() });
        });

        // --- FILTRADO EN CLIENTE (JavaScript) ---
        // Refinamos los resultados con el resto de filtros
        const filteredDocs = docs.filter(item => {
            // 1. Filtro Zona
            if (level0 && item.level0 !== level0) return false;
            
            // 2. Filtro Categoría
            if (category && item.category !== category) return false;
            
            // Filtro Banco
            if (bank && item.bank !== bank) return false;

            // 3. Filtro Comercio
            if (merchant && item.merchant !== merchant) return false;
            
            // 4. Filtro Concepto
            if (product && item.product !== product) return false;

            // 5. Filtro Devoluciones (si está marcado)
            if (showReturns && (parseFloat(item.amount) || 0) >= 0) return false;

            // 6. Filtro Fecha (Manual para soportar formatos mixtos YYYY-MM-DD y DD/MM/YYYY)
            if (dateStart || dateEnd) {
                let itemDateStr = item.date;
                // Si la fecha guardada es antigua (DD/MM/YYYY), la convertimos para comparar
                if (itemDateStr && itemDateStr.includes('/')) {
                    const [d, m, y] = itemDateStr.split('/');
                    itemDateStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                }
                
                if (dateStart && itemDateStr < dateStart) return false;
                if (dateEnd && itemDateStr > dateEnd) return false;
            }

            return true;
        });

        // Resetear ordenación por defecto al buscar
        sortState = { column: 'date', direction: 'desc' };

        // Guardamos los datos en la variable global
        originalFilteredDocs = [...filteredDocs]; // Guardamos copia para poder restaurar tras filtrar por gráfico
        currentFilteredDocs = filteredDocs;

        console.log(`✅ Resultados finales tras filtrar: ${filteredDocs.length}`);

        // Renderizamos la tabla según el modo actual
        renderTable();
        renderChart(); // Actualizar gráfico

    } catch (error) {
        console.error("❌ Error consultando:", error);
        resultsTableBody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center; padding: 20px;">Error: ${error.message}<br>Revisa la consola (F12) para más detalles.</td></tr>`;
    }
}

// Función para limpiar los filtros y los resultados
function clearFilters() {
    document.getElementById('filterLevel0').value = '';
    document.getElementById('filterMerchant').value = '';
    document.getElementById('filterProduct').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterDateStart').value = '';
    document.getElementById('filterDateEnd').value = '';
    document.getElementById('filterReturns').checked = false;

    // Limpiar la tabla, gráfico y estadísticas
    resultsTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: #666;">Pulsa "Buscar" para mostrar los datos.</td></tr>';
    if (resultsTableFoot) resultsTableFoot.innerHTML = '';
    totalResultsSpan.textContent = 'Gastos: 0.00 €';
    if(totalIncomesSpan) totalIncomesSpan.textContent = 'Ingresos: 0.00 €';
    if(totalBalanceSpan) {
        totalBalanceSpan.textContent = 'Balance: 0.00 €';
        totalBalanceSpan.style.color = '#333';
    }
    currentTotalIncome = 0;
    currentFilteredDocs = [];
    originalFilteredDocs = [];
    if (expenseChart) {
        expenseChart.destroy();
        expenseChart = null;
    }
    updateStats();
}

// Función para renderizar la tabla (separada de la búsqueda)
function renderTable() {
    resultsTableBody.innerHTML = '';
    
    // Gestionar visibilidad de totales globales
    totalResultsSpan.style.display = 'inline';
    totalIncomesSpan.style.display = 'inline';
    if (totalBalanceSpan) totalBalanceSpan.style.display = 'inline';

    if (resultsTableFoot) resultsTableFoot.innerHTML = ''; // Limpiar pie anterior
    let totalAmount = 0;

    if (currentFilteredDocs.length === 0) {
        resultsTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: #666;">⚠️ No se encontraron resultados con estos filtros.</td></tr>';
        totalResultsSpan.textContent = 'Gastos: 0.00 €';
        updateStats(); // Actualizar estadísticas a 0
        return;
    }

    // Helper para iconos de ordenación
    const getSortIcon = (col) => {
        if (sortState.column !== col) return '';
        return sortState.direction === 'asc' ? ' ▲' : ' ▼';
    };

    // --- MODO DETALLE ---
    if (currentViewMode === 'detail') {
        // Ordenar datos
        currentFilteredDocs.sort((a, b) => {
            let valA = a[sortState.column];
            let valB = b[sortState.column];
            
            if (sortState.column === 'amount') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }
            
            if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
            return 0;
        });

        // Actualizar Cabecera
        resultsTableHead.innerHTML = `
            <tr>
                <th data-sort="date" style="cursor: pointer; width: 110px;">Fecha${getSortIcon('date')}</th>
                <th data-sort="level0" style="cursor: pointer;">Zona${getSortIcon('level0')}</th>
                <th data-sort="bank" style="cursor: pointer;">Banco${getSortIcon('bank')}</th>
                <th data-sort="merchant" style="cursor: pointer;">Comercio${getSortIcon('merchant')}</th>
                <th data-sort="product" style="cursor: pointer; width: 20%;">Concepto${getSortIcon('product')}</th>
                <th data-sort="category" style="cursor: pointer;">Categoría${getSortIcon('category')}</th>
                <th data-sort="amount" style="cursor: pointer;">Importe${getSortIcon('amount')}</th>
                <th style="width: 125px;">Acciones</th>
            </tr>
        `;

        currentFilteredDocs.forEach(item => {
            const row = document.createElement('tr');
            const amount = parseFloat(item.amount) || 0;
            totalAmount += amount;

            // Formatear fecha de YYYY-MM-DD a DD-MM-YYYY
            let displayDate = item.date;
            if (displayDate && displayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = displayDate.split('-');
                displayDate = `${d}-${m}-${y}`;
            }

            // Sombreado verde si es negativo (devolución)
            if (amount < 0) {
                row.style.backgroundColor = '#d4edda';
            }

            row.innerHTML = `
                <td>${displayDate}</td>
                <td>${item.level0 || '-'}</td>
                <td>${item.bank || '-'}</td>
                <td>${item.merchant}</td>
                <td>${item.product}</td>
                <td>${item.category}</td>
                <td style="text-align: right; font-weight: bold;">${amount.toFixed(2)} €</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button class="action-btn btn-duplicate" data-id="${item.id}" style="background-color: #28a745;" title="Duplicar">📄</button>
                    <button class="action-btn btn-edit" data-id="${item.id}" title="Editar">✏️</button>
                    <button class="action-btn btn-delete" data-id="${item.id}" title="Borrar">🗑️</button>
                </td>
            `;
            resultsTableBody.appendChild(row);
        });
    } 
    // --- MODO SOLO TOTAL (Agrupado) ---
    else if (currentViewMode === 'total') {
        // Actualizar Cabecera
        resultsTableHead.innerHTML = `
            <tr>
                <th data-sort="date" style="cursor: pointer; width: 110px;">Fecha${getSortIcon('date')}</th>
                <th data-sort="level0" style="cursor: pointer;">Zona${getSortIcon('level0')}</th>
                <th data-sort="bank" style="cursor: pointer;">Banco${getSortIcon('bank')}</th>
                <th data-sort="merchant" style="cursor: pointer;">Comercio${getSortIcon('merchant')}</th>
                <th style="width: 20%;">Concepto</th>
                <th>Categoría</th>
                <th data-sort="amount" style="cursor: pointer;">Importe Total${getSortIcon('amount')}</th>
                <th style="width: 125px;">Acciones</th>
            </tr>
        `;

        // Agrupar datos por (Fecha + Comercio + Zona)
        const groups = {};
        currentFilteredDocs.forEach(item => {
            const key = `${item.date}|${item.merchant}|${item.level0}|${item.bank || 'N/A'}`;
            if (!groups[key]) {
                groups[key] = {
                    date: item.date,
                    merchant: item.merchant,
                    level0: item.level0,
                    bank: item.bank || 'N/A',
                    amount: 0,
                    ids: [], // Guardamos todos los IDs de este grupo
                    items: [] // Guardamos los items completos para el detalle desplegable
                };
            }
            groups[key].amount += parseFloat(item.amount) || 0;
            groups[key].ids.push(item.id);
            groups[key].items.push(item);
        });

        // Convertir a array y ordenar
        const sortedGroups = Object.values(groups).sort((a, b) => {
            let valA = a[sortState.column];
            let valB = b[sortState.column];
            
            if (sortState.column === 'amount') {
                // amount ya es número
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }
            
            if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
            return 0;
        });

        sortedGroups.forEach(group => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.title = "Haz clic para ver el detalle de productos";
            
            // Sombreado verde si es negativo (devolución)
            const defaultBg = group.amount < 0 ? '#d4edda' : '';
            row.style.backgroundColor = defaultBg;

            totalAmount += group.amount;

            // En modo total, el botón de borrar eliminará TODO el grupo
            // Convertimos el array de IDs a string para pasarlo al botón (o usamos un índice)
            const idsString = JSON.stringify(group.ids);

            // Formatear fecha de YYYY-MM-DD a DD-MM-YYYY
            let displayDate = group.date;
            if (displayDate && displayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = displayDate.split('-');
                displayDate = `${d}-${m}-${y}`;
            }

            // Obtener conceptos y categorías únicos para mostrar en la fila resumen
            const concepts = [...new Set(group.items.map(i => i.product))].join(', ');
            const categories = [...new Set(group.items.map(i => i.category))].join(', ');

            row.innerHTML = `
                <td>${displayDate}</td>
                <td>${group.level0 || '-'}</td>
                <td>${group.bank === 'N/A' ? '-' : group.bank}</td>
                <td>${group.merchant}</td>
                <td style="font-size: 0.9rem; color: #555;">${concepts}</td>
                <td style="font-size: 0.9rem; color: #555;">${categories}</td>
                <td style="text-align: right; font-weight: bold;">${group.amount.toFixed(2)} €</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button class="action-btn btn-view-group" style="background-color: #17a2b8; margin-right: 5px;" title="Ver Detalle">👁️</button>
                    <button class="action-btn btn-delete-group" data-ids='${idsString}' title="Borrar Ticket Completo">🗑️</button>
                </td>
            `;

            // --- FILA DE DETALLE (Oculta por defecto) ---
            const detailRow = document.createElement('tr');
            detailRow.style.display = 'none';
            detailRow.style.backgroundColor = '#f8f9fa';

            let detailsHtml = `
                <td colspan="8" style="padding: 15px;">
                    <div style="margin-bottom: 5px; font-weight: bold; color: #555;">Detalle de conceptos:</div>
                    <table style="width: 100%; background: white; border: 1px solid #dee2e6; font-size: 0.9rem;">
                        <thead style="background-color: #e9ecef;">
                            <tr>
                                <th style="padding: 8px;">Concepto</th>
                                <th style="padding: 8px;">Categoría</th>
                                <th style="padding: 8px; text-align: right;">Importe</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            group.items.forEach(item => {
                const itemAmount = parseFloat(item.amount) || 0;
                const itemStyle = itemAmount < 0 ? 'background-color: #d4edda;' : '';
                detailsHtml += `
                    <tr style="${itemStyle}">
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.category}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${itemAmount.toFixed(2)} €</td>
                    </tr>
                `;
            });

            detailsHtml += `</tbody></table></td>`;
            detailRow.innerHTML = detailsHtml;

            // Evento para desplegar/ocultar
            row.addEventListener('click', (e) => {
                // Evitar desplegar si pulsamos el botón de borrar
                if (e.target.closest('.btn-delete-group')) return;

                if (detailRow.style.display === 'none') {
                    detailRow.style.display = 'table-row';
                    row.style.backgroundColor = '#e2e6ea'; // Resaltar fila activa
                } else {
                    detailRow.style.display = 'none';
                    row.style.backgroundColor = defaultBg; // Restaurar color original
                }
            });

            resultsTableBody.appendChild(row);
            resultsTableBody.appendChild(detailRow);
        });
    }

    // --- RENDERIZAR PIE DE TABLA (TOTAL GLOBAL) ---
    if (resultsTableFoot) {
        const colspan = 6; // Ahora ambos modos tienen 6 columnas antes del importe
        resultsTableFoot.innerHTML = `
            <tr style="background-color: #e9ecef; border-top: 2px solid #dee2e6;">
                <td colspan="${colspan}" style="text-align: right; font-weight: bold; padding: 12px;">TOTAL GLOBAL:</td>
                <td style="text-align: right; font-weight: bold; font-size: 1.1em; padding: 12px; color: #007bff;">${totalAmount.toFixed(2)} €</td>
                <td></td>
            </tr>
        `;
    }

        totalResultsSpan.textContent = `Gastos: ${totalAmount.toFixed(2)} €`;

        // Actualizar Balance
        if (totalBalanceSpan) {
            const balance = currentTotalIncome - totalAmount;
            totalBalanceSpan.textContent = `Balance: ${balance.toFixed(2)} €`;
            totalBalanceSpan.style.color = balance >= 0 ? '#28a745' : '#dc3545';
        }

        // Añadir eventos a los botones generados
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => deleteExpense(e.target.dataset.id));
        });
    document.querySelectorAll('.btn-delete-group').forEach(btn => {
        btn.addEventListener('click', (e) => deleteGroup(JSON.parse(e.currentTarget.dataset.ids)));
    });
        document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => openEditModal(e.target.dataset.id, currentFilteredDocs));
        });
        document.querySelectorAll('.btn-duplicate').forEach(btn => {
            btn.addEventListener('click', (e) => openDuplicateModal(e.target.dataset.id, currentFilteredDocs));
        });
    updateStats(); // Actualizar estadísticas con los datos visibles
}

// Función para renderizar el gráfico circular
function renderChart() {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    // Comprobar si hay una categoría seleccionada en el filtro
    const selectedCategoryFilter = document.getElementById('filterCategory').value;
    const isCategorySelected = selectedCategoryFilter !== "";

    // Calcular totales (por Categoría o por Comercio)
    const dataTotals = {};
    currentFilteredDocs.forEach(item => {
        const key = isCategorySelected ? (item.merchant || 'Sin Comercio') : (item.category || 'Sin Categoría');
        const amount = parseFloat(item.amount) || 0;
        dataTotals[key] = (dataTotals[key] || 0) + amount;
    });

    // Crear etiquetas con el importe incluido
    const labels = Object.keys(dataTotals).map(key => {
        return `${key}: ${dataTotals[key].toFixed(2)} €`;
    });
    const data = Object.values(dataTotals);
    
    // Mapear colores
    const backgroundColors = Object.keys(dataTotals).map(key => {
        if (isCategorySelected) {
            // Generar color basado en hash para comercios (para que sea consistente)
            let hash = 0;
            for (let i = 0; i < key.length; i++) {
                hash = key.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash % 360);
            return `hsl(${hue}, 70%, 60%)`;
        } else {
            // Usar color de categoría si existe
            return categoryColors[key] || '#cccccc';
        }
    });

    // Destruir gráfico anterior si existe para no superponerlos
    if (expenseChart) {
        expenseChart.destroy();
    }

    // Crear nuevo gráfico
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: { 
                    display: true, 
                    text: isCategorySelected ? `Gastos por Comercio (${selectedCategoryFilter})` : 'Gastos por Categoría' 
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    // Clic en un segmento: Filtrar tabla
                    const index = elements[0].index;
                    const label = expenseChart.data.labels[index];
                    // El label es "Clave: Importe €", extraemos solo la clave
                    const selectedKey = label.split(':')[0].trim();

                    // Filtramos sobre los datos ORIGINALES de la búsqueda
                    if (isCategorySelected) {
                        // Filtrar por comercio
                        currentFilteredDocs = originalFilteredDocs.filter(item => (item.merchant || 'Sin Comercio') === selectedKey);
                    } else {
                        // Filtrar por categoría
                        currentFilteredDocs = originalFilteredDocs.filter(item => (item.category || 'Sin Categoría') === selectedKey);
                    }
                    renderTable();
                } else {
                    // Clic en el fondo: Restaurar todos los datos
                    currentFilteredDocs = [...originalFilteredDocs];
                    renderTable();
                }
            },
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
            }
        }
    });
}

// Función para actualizar el resumen estadístico
function updateStats() {
    // Agrupar por ticket para contar tickets reales y no productos sueltos
    const tickets = {};
    let totalAmount = 0;

    currentFilteredDocs.forEach(item => {
        // Usamos la misma clave de agrupación que en la vista "Solo Total"
        const key = `${item.date}|${item.merchant}|${item.level0}`;
        if (!tickets[key]) tickets[key] = 0;
        
        const amount = parseFloat(item.amount) || 0;
        tickets[key] += amount;
        totalAmount += amount;
    });

    const ticketValues = Object.values(tickets);
    const numTickets = ticketValues.length;
    
    // Cálculos
    const maxExpense = numTickets > 0 ? Math.max(...ticketValues) : 0;
    const avgExpense = numTickets > 0 ? totalAmount / numTickets : 0;

    document.getElementById('statMax').textContent = maxExpense.toFixed(2) + ' €';
    document.getElementById('statAvg').textContent = avgExpense.toFixed(2) + ' €';
    document.getElementById('statCount').textContent = numTickets;
}

// Función para borrar
async function deleteExpense(id) {
    if (await showCustomConfirm("¿Estás seguro de que quieres eliminar este registro permanentemente?")) {
        try {
            await deleteDoc(doc(db, "expenses", id));
            showCustomAlert("Registro eliminado.", "success");
            searchExpenses(); // Recargar tabla
        } catch (error) {
            console.error("Error al borrar:", error);
            showCustomAlert("Error al borrar: " + error.message, "error");
        }
    }
}

// Función para borrar un GRUPO de registros (Ticket completo)
async function deleteGroup(ids) {
    if (await showCustomConfirm(`¿Estás seguro de que quieres eliminar este ticket completo (${ids.length} productos)?`)) {
        try {
            // Borramos uno a uno (Firestore batch sería mejor, pero loop es más simple aquí)
            for (const id of ids) {
                await deleteDoc(doc(db, "expenses", id));
            }
            showCustomAlert("Ticket eliminado correctamente.", "success");
            searchExpenses(); // Recargar tabla
        } catch (error) {
            console.error("Error al borrar grupo:", error);
            showCustomAlert("Error al borrar ticket: " + error.message, "error");
        }
    }
}

// Función para abrir modal de edición
function openEditModal(id, allDocs) {
    const item = allDocs.find(d => d.id === id);
    if (!item) return;

    editModalTitle.textContent = "Editar Gasto";
    saveEditBtn.textContent = "Guardar Cambios";

    document.getElementById('editId').value = id;
    document.getElementById('editLevel0').value = item.level0 || 'MADRID';
    document.getElementById('editMerchant').value = item.merchant;
    document.getElementById('editBank').value = item.bank || '';
    
    // CORRECCIÓN DE FECHA: Si viene en formato antiguo DD/MM/YYYY, convertir a YYYY-MM-DD
    let dateValue = item.date;
    if (dateValue && dateValue.includes('/')) {
        const [d, m, y] = dateValue.split('/');
        dateValue = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    document.getElementById('editDate').value = dateValue;
    
    document.getElementById('editProduct').value = item.product;
    document.getElementById('editCategory').value = item.category;
    document.getElementById('editAmount').value = item.amount;

    editModalOverlay.style.display = 'flex';
}

// Función para abrir modal en modo DUPLICAR
function openDuplicateModal(id, allDocs) {
    const item = allDocs.find(d => d.id === id);
    if (!item) return;

    editModalTitle.textContent = "Duplicar Gasto";
    saveEditBtn.textContent = "Crear Nuevo Gasto";

    document.getElementById('editId').value = ""; // ID vacío indica creación
    document.getElementById('editLevel0').value = item.level0 || 'MADRID';
    document.getElementById('editMerchant').value = item.merchant;
    document.getElementById('editBank').value = item.bank || '';
    
    let dateValue = item.date;
    if (dateValue && dateValue.includes('/')) {
        const [d, m, y] = dateValue.split('/');
        dateValue = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    document.getElementById('editDate').value = dateValue;
    
    document.getElementById('editProduct').value = item.product;
    document.getElementById('editCategory').value = item.category;
    document.getElementById('editAmount').value = item.amount;

    editModalOverlay.style.display = 'flex';
}

// Guardar edición
saveEditBtn.addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    const updatedData = {
        level0: document.getElementById('editLevel0').value,
        merchant: document.getElementById('editMerchant').value,
        bank: document.getElementById('editBank').value.trim(),
        date: document.getElementById('editDate').value,
        product: document.getElementById('editProduct').value,
        category: document.getElementById('editCategory').value,
        amount: parseFloat(document.getElementById('editAmount').value)
    };
    
    // Asegurar que el UID se mantiene o se añade
    if (!id) updatedData.uid = currentUser.uid;

    saveEditBtn.textContent = "Guardando...";
    saveEditBtn.disabled = true;

    try {
        if (id) {
            // MODO EDICIÓN
            const docRef = doc(db, "expenses", id);
            await updateDoc(docRef, updatedData);
            showCustomAlert("Registro actualizado correctamente.", "success");
        } else {
            // MODO DUPLICACIÓN (Crear nuevo)
            await addDoc(collection(db, "expenses"), updatedData);
            showCustomAlert("Nuevo gasto creado correctamente.", "success");
        }
        
        editModalOverlay.style.display = 'none';
        searchExpenses(); // Recargar tabla
    } catch (error) {
        console.error("Error al guardar:", error);
        showCustomAlert("Error al guardar: " + error.message, "error");
    } finally {
        saveEditBtn.disabled = false;
    }
});

closeEditBtn.addEventListener('click', () => {
    editModalOverlay.style.display = 'none';
});

// Función para establecer rango de fechas (Mes Actual / Anterior)
function setDateFilter(mode) {
    const now = new Date();
    let start, end;

    if (mode === 'current') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (mode === 'previous') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (mode === 'year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
    }

    // Formato local YYYY-MM-DD
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    document.getElementById('filterDateStart').value = fmt(start);
    document.getElementById('filterDateEnd').value = fmt(end);
}

// Event Listeners
if(searchBtn) {
    searchBtn.addEventListener('click', searchExpenses);

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }

    if (btnPrevMonth) {
        btnPrevMonth.addEventListener('click', () => {
            setDateFilter('previous');
            searchExpenses();
        });
    }
    if (btnCurrMonth) {
        btnCurrMonth.addEventListener('click', () => {
            setDateFilter('current');
            searchExpenses();
        });
    }
    if (btnCurrYear) {
        btnCurrYear.addEventListener('click', () => {
            setDateFilter('year');
            searchExpenses();
        });
    }

    // Cargar comercios al iniciar
    // loadFilterOptions(); // Se llama en onAuthStateChanged
    // loadConfig();

    // Eventos botones de vista
    btnViewTotal.addEventListener('click', () => {
        currentViewMode = 'total';
        btnViewTotal.style.backgroundColor = '#138496'; // Oscurecer activo
        btnViewDetail.style.backgroundColor = '#007bff'; // Reset otro
        if (btnViewAccounts) btnViewAccounts.style.backgroundColor = '#28a745';
        renderTable();
    });
    btnViewDetail.addEventListener('click', () => {
        currentViewMode = 'detail';
        btnViewDetail.style.backgroundColor = '#0056b3'; // Oscurecer activo
        btnViewTotal.style.backgroundColor = '#17a2b8'; // Reset otro
        if (btnViewAccounts) btnViewAccounts.style.backgroundColor = '#28a745';
        renderTable();
    });

    if (btnViewAccounts) {
        btnViewAccounts.addEventListener('click', async () => {
            // 1. Cambiar estado visual y modo
            currentViewMode = 'accounts';
            btnViewAccounts.style.backgroundColor = '#218838'; // Oscurecer activo
            btnViewDetail.style.backgroundColor = '#007bff';
            btnViewTotal.style.backgroundColor = '#17a2b8';

            // 2. Mostrar totales globales y estado de carga
            totalResultsSpan.style.display = 'inline';
            totalIncomesSpan.style.display = 'inline';
            if (totalBalanceSpan) totalBalanceSpan.style.display = 'inline';
            
            totalIncomesSpan.textContent = 'Ingresos: Calculando...';
            totalResultsSpan.textContent = 'Gastos: Calculando...';
            if (totalBalanceSpan) totalBalanceSpan.textContent = 'Balance: Calculando...';

            resultsTableHead.innerHTML = `
                <tr>
                    <th>Banco</th>
                    <th style="text-align: right;">Ingresos</th>
                    <th style="text-align: right;">Gastos</th>
                    <th style="text-align: right;">Balance</th>
                </tr>
            `;
            resultsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Cargando balance de cuentas...</td></tr>';
            if (resultsTableFoot) resultsTableFoot.innerHTML = '';

            try {
                // 3. Cargar TODOS los datos sin filtros
                const expensesQuery = query(collection(db, "expenses"), where("uid", "==", currentUser.uid));
                const incomesQuery = query(collection(db, "incomes"), where("uid", "==", currentUser.uid));

                const [expensesSnap, incomesSnap] = await Promise.all([
                    getDocs(expensesQuery),
                    getDocs(incomesQuery)
                ]);

                const allExpenses = [];
                expensesSnap.forEach(doc => allExpenses.push({ id: doc.id, ...doc.data() }));
                
                const allIncomes = [];
                incomesSnap.forEach(doc => allIncomes.push({ id: doc.id, ...doc.data() }));

                // 4. Procesar y agrupar datos
                const bankAccounts = {};

                allExpenses.forEach(item => {
                    const bank = item.bank || 'Sin Banco';
                    if (!bankAccounts[bank]) {
                        bankAccounts[bank] = { incomes: 0, expenses: 0, movements: [] };
                    }
                    bankAccounts[bank].expenses += parseFloat(item.amount) || 0;
                    bankAccounts[bank].movements.push({ ...item, type: 'expense' });
                });

                allIncomes.forEach(item => {
                    const bank = item.bank || 'Sin Banco';
                    if (!bankAccounts[bank]) {
                        bankAccounts[bank] = { incomes: 0, expenses: 0, movements: [] };
                    }
                    bankAccounts[bank].incomes += parseFloat(item.amount) || 0;
                    bankAccounts[bank].movements.push({ ...item, type: 'income' });
                });

                // 5. Renderizar la tabla de cuentas
                resultsTableBody.innerHTML = '';
                if (Object.keys(bankAccounts).length === 0) {
                    resultsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #777;">No se encontraron movimientos en cuentas bancarias.</td></tr>';
                    return;
                }

                // Variables para el total general
                let totalIncomesGlobal = 0;
                let totalExpensesGlobal = 0;

                Object.keys(bankAccounts).sort().forEach(bankName => {
                    const account = bankAccounts[bankName];
                    const balance = account.incomes - account.expenses;

                    const row = document.createElement('tr');
                    row.style.cursor = 'pointer';
                    row.title = 'Haz clic para ver movimientos';

                    // Acumular para el total general
                    totalIncomesGlobal += account.incomes;
                    totalExpensesGlobal += account.expenses;

                    row.innerHTML = `
                        <td style="font-weight: bold;">${bankName}</td>
                        <td style="text-align: right; color: #28a745;">${account.incomes.toFixed(2)} €</td>
                        <td style="text-align: right; color: #dc3545;">${account.expenses.toFixed(2)} €</td>
                        <td style="text-align: right; font-weight: bold; color: ${balance >= 0 ? '#28a745' : '#dc3545'};">${balance.toFixed(2)} €</td>
                    `;

                    const detailRow = document.createElement('tr');
                    detailRow.style.display = 'none';
                    detailRow.style.backgroundColor = '#f8f9fa';

                    let detailsHtml = `<td colspan="4" style="padding: 15px;"><table style="width: 100%; background: white; border: 1px solid #eee; font-size: 0.9rem;"><thead><tr><th>Fecha</th><th>Concepto</th><th style="text-align: right;">Importe</th></tr></thead><tbody>`;
                    account.movements.sort((a, b) => new Date(b.date) - new Date(a.date));
                    account.movements.forEach(mov => {
                        const amount = parseFloat(mov.amount) || 0;
                        const concept = mov.type === 'expense' ? `${mov.merchant} - ${mov.product}` : mov.concept;
                        const color = mov.type === 'expense' ? '#dc3545' : '#28a745';
                        let displayDate = mov.date;
                        if (displayDate && displayDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            const [y, m, d] = displayDate.split('-');
                            displayDate = `${d}-${m}-${y}`;
                        }
                        detailsHtml += `<tr><td style="padding: 8px;">${displayDate}</td><td style="padding: 8px;">${concept}</td><td style="padding: 8px; text-align: right; color: ${color};">${mov.type === 'expense' ? '-' : ''}${amount.toFixed(2)} €</td></tr>`;
                    });
                    detailsHtml += '</tbody></table></td>';
                    detailRow.innerHTML = detailsHtml;

                    row.addEventListener('click', () => {
                        detailRow.style.display = detailRow.style.display === 'none' ? 'table-row' : 'none';
                    });

                    resultsTableBody.appendChild(row);
                    resultsTableBody.appendChild(detailRow);
                });

                // 6. Renderizar los totales en los spans de la cabecera
                const totalBalanceGlobal = totalIncomesGlobal - totalExpensesGlobal;
                totalIncomesSpan.textContent = `Ingresos: ${totalIncomesGlobal.toFixed(2)} €`;
                totalResultsSpan.textContent = `Gastos: ${totalExpensesGlobal.toFixed(2)} €`;
                if (totalBalanceSpan) {
                    totalBalanceSpan.textContent = `Balance: ${totalBalanceGlobal.toFixed(2)} €`;
                    totalBalanceSpan.style.color = totalBalanceGlobal >= 0 ? '#28a745' : '#dc3545';
                }

                if (resultsTableFoot) resultsTableFoot.innerHTML = '';

            } catch (error) {
                console.error("Error al cargar el balance de cuentas:", error);
                resultsTableBody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">Error al cargar el balance: ${error.message}</td></tr>`;
            }
        });
    }
}

// Evento clic en Ingresos para ir a la página de gestión con filtros
if (totalIncomesSpan) {
    totalIncomesSpan.addEventListener('click', () => {
        const start = document.getElementById('filterDateStart').value;
        const end = document.getElementById('filterDateEnd').value;
        window.location.href = `ingresos.html?start=${start}&end=${end}`;
    });
}