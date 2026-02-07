import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

console.log("✅ Script consultas.js cargado y Firebase inicializado.");

// Elementos del DOM
const searchBtn = document.getElementById('searchBtn');
const resultsTableBody = document.querySelector('#resultsTable tbody');
const totalResultsSpan = document.getElementById('totalResults');
const resultsTableHead = document.querySelector('#resultsTable thead');
const resultsTableFoot = document.querySelector('#resultsTable tfoot');
const btnViewTotal = document.getElementById('btnViewTotal');
const btnViewDetail = document.getElementById('btnViewDetail');

let currentFilteredDocs = []; // Almacena los datos actuales para no re-consultar al cambiar vista
let originalFilteredDocs = []; // Copia de seguridad de los resultados de búsqueda para filtros locales (gráfico)
let currentViewMode = 'detail'; // 'detail' o 'total'
let expenseChart = null; // Variable para el gráfico
let categoryColors = {}; // Mapa de colores por categoría
let sortState = { column: 'date', direction: 'desc' }; // Estado de ordenación

// Elementos del Modal de Edición
const editModalOverlay = document.getElementById('editModalOverlay');
const closeEditBtn = document.getElementById('closeEditBtn');
const saveEditBtn = document.getElementById('saveEditBtn');

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

// Función para cargar comercios únicos en el desplegable
async function loadMerchants() {
    const merchantSelect = document.getElementById('filterMerchant');
    // Indicador de carga
    merchantSelect.innerHTML = '<option value="">Cargando...</option>';

    try {
        const querySnapshot = await getDocs(collection(db, "expenses"));
        const merchants = new Set();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.merchant) {
                merchants.add(data.merchant.trim());
            }
        });

        const sortedMerchants = Array.from(merchants).sort();

        merchantSelect.innerHTML = '<option value="">Todos</option>';
        sortedMerchants.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            merchantSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando comercios:", error);
        merchantSelect.innerHTML = '<option value="">Error</option>';
    }
}

// Función para cargar configuración (Zonas y Categorías)
async function loadConfig() {
    try {
        const levelsSnap = await getDocs(collection(db, "levels"));
        const catsSnap = await getDocs(collection(db, "categories"));

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
    resultsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">⏳ Cargando datos de la nube...</td></tr>';
    
    const level0 = document.getElementById('filterLevel0').value;
    const merchant = document.getElementById('filterMerchant').value;
    const category = document.getElementById('filterCategory').value;
    const dateStart = document.getElementById('filterDateStart').value;
    const dateEnd = document.getElementById('filterDateEnd').value;

    try {
        let q = collection(db, "expenses");
        
        // ESTRATEGIA ROBUSTA:
        // Para evitar errores de "Falta Índice" en Firestore al combinar muchos filtros,
        // filtraremos en la nube solo por FECHA (si existe) o NIVEL 0, y el resto en JavaScript.
        
        if (level0) {
            // Filtramos en la nube por Zona si está seleccionado
            q = query(q, where("level0", "==", level0));
        }
        // Si no hay ni fechas ni zona, traemos todo (Firestore es rápido leyendo)

        const querySnapshot = await getDocs(q);
        console.log(`📡 Documentos recuperados de Firestore: ${querySnapshot.size}`);

        let docs = [];
        querySnapshot.forEach((doc) => {
            docs.push({ id: doc.id, ...doc.data() });
        });

        // --- FILTRADO EN CLIENTE (JavaScript) ---
        // Refinamos los resultados con el resto de filtros
        const filteredDocs = docs.filter(item => {
            // 1. Filtro Zona (si no se usó en la query principal)
            if (level0 && item.level0 !== level0) return false;
            
            // 2. Filtro Categoría
            if (category && item.category !== category) return false;
            
            // 3. Filtro Comercio (Coincidencia exacta ahora que es desplegable)
            if (merchant && item.merchant !== merchant) return false;
            
            // 4. Filtro Fecha (Manual para soportar formatos mixtos YYYY-MM-DD y DD/MM/YYYY)
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
        resultsTableBody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center; padding: 20px;">Error: ${error.message}<br>Revisa la consola (F12) para más detalles.</td></tr>`;
    }
}

// Función para renderizar la tabla (separada de la búsqueda)
function renderTable() {
    resultsTableBody.innerHTML = '';
    if (resultsTableFoot) resultsTableFoot.innerHTML = ''; // Limpiar pie anterior
    let totalAmount = 0;

    if (currentFilteredDocs.length === 0) {
        resultsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #666;">⚠️ No se encontraron resultados con estos filtros.</td></tr>';
        totalResultsSpan.textContent = 'Total: 0.00 €';
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
                <th data-sort="date" style="cursor: pointer;">Fecha${getSortIcon('date')}</th>
                <th data-sort="level0" style="cursor: pointer;">Zona${getSortIcon('level0')}</th>
                <th data-sort="merchant" style="cursor: pointer;">Comercio${getSortIcon('merchant')}</th>
                <th data-sort="product" style="cursor: pointer;">Concepto${getSortIcon('product')}</th>
                <th data-sort="category" style="cursor: pointer;">Categoría${getSortIcon('category')}</th>
                <th data-sort="amount" style="cursor: pointer;">Importe${getSortIcon('amount')}</th>
                <th>Acciones</th>
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

            row.innerHTML = `
                <td>${displayDate}</td>
                <td>${item.level0 || '-'}</td>
                <td>${item.merchant}</td>
                <td>${item.product}</td>
                <td>${item.category}</td>
                <td style="text-align: right; font-weight: bold;">${amount.toFixed(2)} €</td>
                <td style="text-align: center;">
                    <button class="action-btn btn-edit" data-id="${item.id}">✏️</button>
                    <button class="action-btn btn-delete" data-id="${item.id}">🗑️</button>
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
                <th data-sort="date" style="cursor: pointer;">Fecha${getSortIcon('date')}</th>
                <th data-sort="level0" style="cursor: pointer;">Zona${getSortIcon('level0')}</th>
                <th data-sort="merchant" style="cursor: pointer;">Comercio${getSortIcon('merchant')}</th>
                <th data-sort="amount" style="cursor: pointer;">Importe Total${getSortIcon('amount')}</th>
                <th>Acciones</th>
            </tr>
        `;

        // Agrupar datos por (Fecha + Comercio + Zona)
        const groups = {};
        currentFilteredDocs.forEach(item => {
            const key = `${item.date}|${item.merchant}|${item.level0}`;
            if (!groups[key]) {
                groups[key] = {
                    date: item.date,
                    merchant: item.merchant,
                    level0: item.level0,
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

            row.innerHTML = `
                <td>${displayDate}</td>
                <td>${group.level0 || '-'}</td>
                <td>${group.merchant}</td>
                <td style="text-align: right; font-weight: bold;">${group.amount.toFixed(2)} €</td>
                <td style="text-align: center;">
                    <button class="action-btn btn-view-group" style="background-color: #17a2b8; margin-right: 5px;" title="Ver Detalle">👁️</button>
                    <button class="action-btn btn-delete-group" data-ids='${idsString}' title="Borrar Ticket Completo">🗑️</button>
                </td>
            `;

            // --- FILA DE DETALLE (Oculta por defecto) ---
            const detailRow = document.createElement('tr');
            detailRow.style.display = 'none';
            detailRow.style.backgroundColor = '#f8f9fa';

            let detailsHtml = `
                <td colspan="5" style="padding: 15px;">
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
                detailsHtml += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.category}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${parseFloat(item.amount).toFixed(2)} €</td>
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
                    row.style.backgroundColor = ''; // Quitar resalte
                }
            });

            resultsTableBody.appendChild(row);
            resultsTableBody.appendChild(detailRow);
        });
    }

    // --- RENDERIZAR PIE DE TABLA (TOTAL GLOBAL) ---
    if (resultsTableFoot) {
        const colspan = currentViewMode === 'detail' ? 5 : 3;
        resultsTableFoot.innerHTML = `
            <tr style="background-color: #e9ecef; border-top: 2px solid #dee2e6;">
                <td colspan="${colspan}" style="text-align: right; font-weight: bold; padding: 12px;">TOTAL GLOBAL:</td>
                <td style="text-align: right; font-weight: bold; font-size: 1.1em; padding: 12px; color: #007bff;">${totalAmount.toFixed(2)} €</td>
                <td></td>
            </tr>
        `;
    }

        totalResultsSpan.textContent = `Total: ${totalAmount.toFixed(2)} €`;

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
    updateStats(); // Actualizar estadísticas con los datos visibles
}

// Función para renderizar el gráfico circular
function renderChart() {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    // Calcular totales por categoría
    const categoryTotals = {};
    currentFilteredDocs.forEach(item => {
        const cat = item.category || 'Sin Categoría';
        const amount = parseFloat(item.amount) || 0;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
    });

    // Crear etiquetas con el importe incluido (Ej: "Alimentación: 50.00 €")
    const labels = Object.keys(categoryTotals).map(cat => {
        return `${cat}: ${categoryTotals[cat].toFixed(2)} €`;
    });
    const data = Object.values(categoryTotals);
    
    // Mapear colores según la categoría
    const backgroundColors = Object.keys(categoryTotals).map(cat => {
        // Si tenemos color guardado lo usamos, si no, uno gris por defecto
        return categoryColors[cat] || '#cccccc';
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
                title: { display: true, text: 'Gastos por Categoría' }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    // Clic en un segmento: Filtrar tabla por esa categoría
                    const index = elements[0].index;
                    const label = expenseChart.data.labels[index];
                    // El label es "Categoría: Importe €", extraemos solo la categoría
                    const selectedCategory = label.split(':')[0].trim();

                    // Filtramos sobre los datos ORIGINALES de la búsqueda
                    currentFilteredDocs = originalFilteredDocs.filter(item => (item.category || 'Sin Categoría') === selectedCategory);
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
    if (confirm("¿Estás seguro de que quieres eliminar este registro permanentemente?")) {
        try {
            await deleteDoc(doc(db, "expenses", id));
            alert("Registro eliminado.");
            searchExpenses(); // Recargar tabla
        } catch (error) {
            console.error("Error al borrar:", error);
            alert("Error al borrar el registro: " + error.message);
        }
    }
}

// Función para borrar un GRUPO de registros (Ticket completo)
async function deleteGroup(ids) {
    if (confirm(`¿Estás seguro de que quieres eliminar este ticket completo (${ids.length} productos)?`)) {
        try {
            // Borramos uno a uno (Firestore batch sería mejor, pero loop es más simple aquí)
            for (const id of ids) {
                await deleteDoc(doc(db, "expenses", id));
            }
            alert("Ticket eliminado correctamente.");
            searchExpenses(); // Recargar tabla
        } catch (error) {
            console.error("Error al borrar grupo:", error);
            alert("Error al borrar el ticket: " + error.message);
        }
    }
}

// Función para abrir modal de edición
function openEditModal(id, allDocs) {
    const item = allDocs.find(d => d.id === id);
    if (!item) return;

    document.getElementById('editId').value = id;
    document.getElementById('editLevel0').value = item.level0 || 'MADRID';
    document.getElementById('editMerchant').value = item.merchant;
    
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

// Guardar edición
saveEditBtn.addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    const updatedData = {
        level0: document.getElementById('editLevel0').value,
        merchant: document.getElementById('editMerchant').value,
        date: document.getElementById('editDate').value,
        product: document.getElementById('editProduct').value,
        category: document.getElementById('editCategory').value,
        amount: parseFloat(document.getElementById('editAmount').value)
    };

    saveEditBtn.textContent = "Guardando...";
    saveEditBtn.disabled = true;

    try {
        const docRef = doc(db, "expenses", id);
        await updateDoc(docRef, updatedData);
        alert("Registro actualizado correctamente.");
        editModalOverlay.style.display = 'none';
        searchExpenses(); // Recargar tabla
    } catch (error) {
        console.error("Error al actualizar:", error);
        alert("Error al guardar los cambios.");
    } finally {
        saveEditBtn.textContent = "Guardar Cambios";
        saveEditBtn.disabled = false;
    }
});

closeEditBtn.addEventListener('click', () => {
    editModalOverlay.style.display = 'none';
});

// Event Listeners
if(searchBtn) {
    searchBtn.addEventListener('click', searchExpenses);
    // Cargar comercios al iniciar
    loadMerchants();
    loadConfig();

    // Eventos botones de vista
    btnViewTotal.addEventListener('click', () => {
        currentViewMode = 'total';
        btnViewTotal.style.backgroundColor = '#138496'; // Oscurecer activo
        btnViewDetail.style.backgroundColor = '#007bff'; // Reset otro
        renderTable();
    });
    btnViewDetail.addEventListener('click', () => {
        currentViewMode = 'detail';
        btnViewDetail.style.backgroundColor = '#0056b3'; // Oscurecer activo
        btnViewTotal.style.backgroundColor = '#17a2b8'; // Reset otro
        renderTable();
    });
}