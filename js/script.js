// --- CONFIGURACIÓN DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, writeBatch, doc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
        loadConfig(); // Cargar configuración solo cuando tenemos usuario
    } else {
        window.location.href = 'login.html';
    }
});

// Configuración del worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const ticketInput = document.getElementById('ticketInput');
const cameraBtn = document.getElementById('cameraBtn');
const cameraOverlay = document.getElementById('cameraOverlay');
const cameraVideo = document.getElementById('cameraVideo');
const captureBtn = document.getElementById('captureBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const ticketResults = document.getElementById('ticketResults');
const statusMessage = document.getElementById('statusMessage');
const ticketsTableBody = document.querySelector('#ticketsTable tbody');
const tableTotalSpan = document.getElementById('tableTotal');
const clearTableBtn = document.getElementById('clearTableBtn');
const saveDbBtn = document.getElementById('saveDbBtn');
const globalMerchantInput = document.getElementById('globalMerchant');
const globalLevel0Input = document.getElementById('globalLevel0');
const globalDateInput = document.getElementById('globalDate');
const ticketInfoDiv = document.querySelector('.ticket-info');

// Elementos del modal manual
const manualEntryCard = document.getElementById('manualEntryCard');
const manualEntryOverlay = document.getElementById('manualEntryOverlay');
const closeManualBtn = document.getElementById('closeManualBtn');
const saveManualDirectBtn = document.getElementById('saveManualDirectBtn');
// Inputs manuales
const manualMerchant = document.getElementById('manualMerchant');
const manualDate = document.getElementById('manualDate');
const manualProduct = document.getElementById('manualProduct');
const manualCategory = document.getElementById('manualCategory');
const manualAmount = document.getElementById('manualAmount');

let globalCategories = ["Alimentación", "Ropa", "Ocio", "Comunidades", "Seguros", "Otros"]; // Fallback por defecto

// Función para cargar configuración desde Firebase
async function loadConfig() {
    if (!currentUser) return;

    try {
        // Cargar Zonas
        // Filtramos por UID para que cada usuario tenga sus zonas
        const levelsSnap = await getDocs(query(collection(db, "levels"), where("uid", "==", currentUser.uid)));
        const levelSelect = document.getElementById('globalLevel0');
        
        if (!levelsSnap.empty) {
            levelSelect.innerHTML = '';
            levelsSnap.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.data().name;
                opt.textContent = doc.data().name;
                if(doc.data().name === 'MADRID') opt.selected = true;
                levelSelect.appendChild(opt);
            });
        }

        // Cargar Categorías
        const catsSnap = await getDocs(query(collection(db, "categories"), where("uid", "==", currentUser.uid)));
        const manualCatSelect = document.getElementById('manualCategory');
        
        if (!catsSnap.empty) {
            manualCatSelect.innerHTML = '';
            globalCategories = [];
            catsSnap.forEach(doc => {
                const name = doc.data().name;
                globalCategories.push(name);
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                manualCatSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Error cargando configuración:", e);
    }
}

// Función para limpiar la tabla y los datos
function clearTable() {
    ticketsTableBody.innerHTML = '';
    globalMerchantInput.value = '';
    globalLevel0Input.value = 'MADRID'; // Restablecer valor por defecto
    globalDateInput.value = '';
    tableTotalSpan.textContent = '0.00 €';
    statusMessage.textContent = 'Esperando imagen...';
    statusMessage.style.color = '#333';

    // Restablecer color de cabecera
    ticketInfoDiv.classList.remove('level-almenara', 'level-global');
    ticketInfoDiv.classList.add('level-madrid');
}

// Evento para el botón de Eliminar Todo
clearTableBtn.addEventListener('click', () => {
    if (ticketsTableBody.children.length > 0 && confirm("¿Estás seguro de que quieres borrar todos los datos de la tabla?")) {
        clearTable();
    }
});

// Evento para cambiar el color de la cabecera según la Zona
globalLevel0Input.addEventListener('change', () => {
    ticketInfoDiv.classList.remove('level-madrid', 'level-almenara', 'level-global');
    const selectedLevel = globalLevel0Input.value.toLowerCase();
    ticketInfoDiv.classList.add(`level-${selectedLevel}`);
});

// Función para guardar datos (Simulación BD)
async function saveDataToDb() {
    const rows = document.querySelectorAll('#ticketsTable tbody tr');
    if (rows.length === 0) return;

    const merchant = globalMerchantInput.value.trim();
    const level0 = globalLevel0Input.value;
    const date = globalDateInput.value.trim();

    if (!merchant || !date) {
        alert("Por favor, rellena el Comercio y la Fecha antes de guardar.");
        return;
    }

    const dataToSave = [];
    let currentTotal = 0;

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const categorySelect = row.querySelector('.category-select');
        const amountText = cells[2].innerText;
        // Convertir a número para cálculos y almacenamiento consistente
        const amountVal = parseFloat(amountText.replace(',', '.').replace('€', '')) || 0;
        
        currentTotal += amountVal;

        dataToSave.push({
            level0: level0,
            merchant: merchant,
            date: date,
            product: cells[0].innerText,
            category: categorySelect.value,
            amount: amountVal, // Guardamos como número
            uid: currentUser.uid // IMPORTANTE: Asociar al usuario
        });
    });

    // --- Comprobación de duplicados en FIRESTORE ---
    try {
        // Consultamos si ya existen gastos con ese comercio y fecha
        const q = query(
            collection(db, "expenses"), 
            where("merchant", "==", merchant), 
            where("date", "==", date),
            where("uid", "==", currentUser.uid) // Solo buscar duplicados propios
        );
        
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Calculamos el total de los documentos encontrados
            let storedTotal = 0;
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                storedTotal += (parseFloat(data.amount) || 0);
            });
            
            // Si el total coincide (con margen de error), avisamos
            if (Math.abs(storedTotal - currentTotal) < 0.05) {
                const confirmSave = confirm(
                    `⚠️ POSIBLE DUPLICADO DETECTADO EN LA NUBE ⚠️\n\n` +
                    `Ya tienes guardados datos para:\n` +
                    `Comercio: ${merchant}\n` +
                    `Fecha: ${date}\n` +
                    `Importe Total: ${storedTotal.toFixed(2)} €\n\n` +
                    `¿Estás seguro de que quieres guardarlo de nuevo?`
                );
                
                if (!confirmSave) {
                    return; // Cancelamos la operación
                }
            }
        }

        // --- Guardar en FIRESTORE (Batch) ---
        // Usamos un batch para guardar todas las filas de una sola vez
        const batch = writeBatch(db);
        
        dataToSave.forEach(item => {
            // Creamos una referencia a un nuevo documento con ID automático
            const docRef = doc(collection(db, "expenses"));
            batch.set(docRef, item);
        });

        await batch.commit();

        console.log("Guardado en Firestore:", dataToSave);
        alert(`✅ Se han guardado ${dataToSave.length} registros en la nube correctamente.`);
        
        clearTable();

    } catch (error) {
        console.error("Error al guardar en Firestore:", error);
        if (error.code === 'permission-denied') {
            alert("❌ PERMISO DENEGADO: Las reglas de seguridad de Firebase están bloqueando el acceso. \n\nVe a la consola de Firebase > Firestore > Reglas y cambia 'if false' por 'if true'.");
        } else {
            alert("❌ Error al guardar en la base de datos. Revisa la consola para más detalles.");
        }
    }
}

async function processFile(file) {
    if (!file) return;

    // Comprobar si hay datos sin guardar
    if (ticketsTableBody.children.length > 0) {
        const wantToSave = confirm("Hay datos de un ticket anterior sin guardar.\n\n¿Quieres GUARDARLOS antes de procesar el nuevo?\n\n[Aceptar] = Guardar y continuar\n[Cancelar] = No guardar (Borrar) y continuar");
        
        if (wantToSave) {
            await saveDataToDb(); // Esperamos a que se guarde en la nube
        } else {
            clearTable();
        }
    } else {
        clearTable();
    }

    // Mostrar estado de carga
    ticketResults.style.display = 'block';
    statusMessage.textContent = "Procesando imagen y extrayendo ítems...";
    statusMessage.style.color = "#007bff";

    try {
        let imageToProcess = file;

        // Si es PDF, lo convertimos a imagen (primera página)
        // Comprobamos tipo MIME o extensión para mayor seguridad
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            const arrayBuffer = await file.arrayBuffer();
            // Usamos Uint8Array y formato objeto para evitar errores en versiones nuevas de PDF.js
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            const page = await pdf.getPage(1); // Solo leemos la página 1
            
            // Renderizamos a MAYOR calidad (escala 3) para que el OCR lea mejor los textos pequeños
            const viewport = page.getViewport({ scale: 3.0 }); 
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            imageToProcess = canvas.toDataURL('image/png');
        }

        // 2. Usar Tesseract.js para OCR (Local y Gratis)
        const result = await Tesseract.recognize(
            imageToProcess,
            'spa', // Idioma español
            { logger: m => console.log(m) } // Ver progreso en consola
        );

        const text = result.data.text;
        console.log("Texto extraído:", text);

        // 3. Lógica simple para buscar patrones (Regex)
        // Buscar fecha (dd/mm/yyyy o dd-mm-yyyy)
        const dateMatch = text.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
        let dateFound = "";
        
        if (dateMatch) {
            // Convertir formato DD/MM/YYYY a YYYY-MM-DD para el input type="date"
            const [day, month, year] = dateMatch[0].split(/[-/]/);
            // Asegurar año de 4 dígitos y ceros a la izquierda
            const fullYear = year.length === 2 ? '20' + year : year;
            dateFound = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Buscar líneas que parezcan items (Texto ... Precio)
        const lines = text.split('\n');
        // Regex mejorada: permite espacios entre enteros y decimales (ej: 12, 50) típicos del OCR
        const priceRegex = /(\d+[\.,]\s?\d{2})\s*€?/; 

        const merchantFound = lines[0] || "No detectado";

        // Rellenamos los campos globales (fuera de la tabla)
        globalMerchantInput.value = merchantFound;
        globalDateInput.value = dateFound;

        let itemsFoundCount = 0;
        lines.forEach(line => {
            // Si la línea tiene un precio y texto largo, probablemente es un item
            if (priceRegex.test(line) && line.length > 5) {
                const priceMatch = line.match(priceRegex);
                // Limpiamos espacios dentro del precio para que sea un número válido (ej: "12, 50" -> "12,50")
                const price = priceMatch[0].replace(/\s/g, '');
                const desc = line.replace(priceMatch[0], '').replace('€', '').trim();
                
                // Añadimos directamente a la tabla
                addTableRow(desc, price);
                itemsFoundCount++;
            }
        });

        statusMessage.textContent = `Proceso finalizado. Se han añadido ${itemsFoundCount} ítems a la tabla.`;
        statusMessage.style.color = "green";
        updateTableTotal();

    } catch (error) {
        console.error(error);
        statusMessage.textContent = "Error al procesar imagen";
        statusMessage.style.color = "red";
    }
}

// Event Listeners
ticketInput.addEventListener('change', (e) => processFile(e.target.files[0]));

// Configuración del botón de cámara
cameraBtn.addEventListener('click', async () => {
    try {
        // Usamos 'ideal' para que funcione en PC (webcam) y en móvil prefiera la trasera
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        cameraVideo.srcObject = stream;
        cameraOverlay.style.display = 'flex';
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        alert("No se pudo acceder a la cámara. Verifica los permisos.");
    }
});

captureBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    canvas.getContext('2d').drawImage(cameraVideo, 0, 0);
    
    // Detener stream
    const stream = cameraVideo.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
    cameraOverlay.style.display = 'none';

    canvas.toBlob(blob => {
        processFile(blob);
    }, 'image/png');
});

closeCameraBtn.addEventListener('click', () => {
    const stream = cameraVideo.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }
    cameraOverlay.style.display = 'none';
});

// Función para adivinar la categoría basada en palabras clave
function guessCategory(productName) {
    const lowerName = productName.toLowerCase();
    
    // Palabras clave para Alimentación
    if (lowerName.match(/(pan|leche|agua|fruta|carne|pescado|arroz|huevo|aceite|cafe|tomate|patata|pollo|cerdo|ternera|queso|yogur|mercadona|carrefour|lidl|dia|consum|alcampo|hipercor|eroski|super|hacendado|galletas|chocolate|atun|ensalada)/)) {
        return "Alimentación";
    }
    // Palabras clave para Ropa
    if (lowerName.match(/(camisa|pantalon|falda|vestido|zapato|zara|mango|h&m|primark|corte ingles|springfield|pull|bershka|stradivarius|decathlon|nike|adidas|camiseta|calcetines|abrigo|chaqueta)/)) {
        return "Ropa";
    }
    // Palabras clave para Ocio
    if (lowerName.match(/(cine|teatro|entrada|restaurante|bar|cena|comida|hotel|viaje|vuelo|netflix|spotify|amazon|hbo|disney|steam|playstation|xbox|nintendo|game|burger|pizza|mcdonalds|kfc|starbucks)/)) {
        return "Ocio";
    }
    // Palabras clave para Comunidades
    if (lowerName.match(/(comunidad|administrador|finca|vecinos|derrama|cuota|recibo)/)) {
        return "Comunidades";
    }
    // Palabras clave para Seguros
    if (lowerName.match(/(seguro|poliza|mapfre|allianz|axa|mutua|sanitas|adeslas|linea directa|genesis|verti|reale|generali|santalucia|ocaso)/)) {
        return "Seguros";
    }
    
    return "Alimentación"; // Categoría por defecto
}

// Función para añadir fila a la tabla
function addTableRow(product, price, category = null) {
    const row = document.createElement('tr');
    
    // Usamos la categoría pasada o intentamos adivinarla
    const selectedCategory = category || guessCategory(product);
    
    let optionsHtml = '';
    globalCategories.forEach(cat => {
        optionsHtml += `<option value="${cat}" ${selectedCategory === cat ? 'selected' : ''}>${cat}</option>`;
    });

    // Celdas editables
    row.innerHTML = `
        <td contenteditable="true">${product}</td>
        <td>
            <select class="category-select">
                ${optionsHtml}
            </select>
        </td>
        <td contenteditable="true" class="price-cell">${price}</td>
        <td><button class="btn-close" style="padding: 5px 10px; font-size: 0.8rem;">X</button></td>
    `;

    // Añadir evento para borrar la fila y recalcular
    row.querySelector('.btn-close').addEventListener('click', () => {
        row.remove();
        updateTableTotal();
    });

    // Formatear importe al perder el foco (añadir € si falta)
    const priceCell = row.querySelector('.price-cell');
    priceCell.addEventListener('blur', () => {
        const text = priceCell.innerText.trim();
        // Si hay texto, no tiene el símbolo € y parece un número válido, lo añadimos
        if (text && !text.includes('€') && !isNaN(parseFloat(text.replace(',', '.').replace('€', '')))) {
            priceCell.innerText = text + ' €';
        }
        updateTableTotal();
    });

    ticketsTableBody.appendChild(row);
}

// Función para calcular el total de la tabla
function updateTableTotal() {
    let total = 0;
    const priceCells = document.querySelectorAll('.price-cell');
    
    priceCells.forEach(cell => {
        // Reemplazamos coma por punto para poder sumar
        const val = parseFloat(cell.innerText.replace(',', '.').replace('€', '')) || 0;
        total += val;
    });

    tableTotalSpan.textContent = total.toFixed(2) + ' €';
}

// Evento para recalcular total al editar la tabla
ticketsTableBody.addEventListener('input', (e) => {
    updateTableTotal();
});

// Funcionalidad del botón Guardar en BD (Simulado)
saveDbBtn.addEventListener('click', saveDataToDb);

// --- Lógica para Recibo Manual ---

let merchantCategoryMap = {}; // Mapa para guardar la última categoría por comercio

// Función para cargar sugerencias de comercios y productos existentes
async function loadManualEntrySuggestions() {
    if (!currentUser) return;
    const datalist = document.getElementById('merchantSuggestions');
    const productDatalist = document.getElementById('productSuggestions');
    if (!merchantDatalist || !productDatalist) return;

    try {
        // Consultamos todos los gastos del usuario
        const q = query(collection(db, "expenses"), where("uid", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);
        const merchants = new Set();
        const products = new Set();
        merchantCategoryMap = {}; // Reiniciar mapa

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Recopilar Comercios y mapear categorías
            if (data.merchant) {
                const m = data.merchant.trim();
                merchants.add(m);

                // Guardar última categoría usada (la más reciente por fecha)
                if (data.category && data.date) {
                    if (!merchantCategoryMap[m] || data.date > merchantCategoryMap[m].date) {
                        merchantCategoryMap[m] = { date: data.date, category: data.category };
                    }
                }
            }
            // Recopilar Productos
            if (data.product) {
                products.add(data.product.trim());
            }
        });

        // Rellenar Datalist Comercios
        merchantDatalist.innerHTML = '';
        Array.from(merchants).sort().forEach(merchant => {
            const option = document.createElement('option');
            option.value = merchant;
            merchantDatalist.appendChild(option);
        });

        // Rellenar Datalist Productos
        productDatalist.innerHTML = '';
        Array.from(products).sort().forEach(product => {
            const option = document.createElement('option');
            option.value = product;
            productDatalist.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando sugerencias:", error);
    }
}

// Evento para autocompletar categoría al elegir comercio
manualMerchant.addEventListener('input', () => {
    const merchant = manualMerchant.value.trim();
    if (merchantCategoryMap[merchant]) {
        manualCategory.value = merchantCategoryMap[merchant].category;
    }
});

manualEntryCard.addEventListener('click', () => {
    manualEntryOverlay.style.display = 'flex';
    // Poner fecha de hoy por defecto
    const today = new Date().toISOString().split('T')[0];
    manualDate.value = today;
    
    // Cargar sugerencias
    loadManualEntrySuggestions();
});

closeManualBtn.addEventListener('click', () => {
    manualEntryOverlay.style.display = 'none';
});

saveManualDirectBtn.addEventListener('click', async () => {
    const merchant = manualMerchant.value.trim();
    const date = manualDate.value;
    const product = manualProduct.value.trim();
    const category = manualCategory.value;
    const amount = parseFloat(manualAmount.value);
    const level0 = globalLevel0Input.value; // Usamos la Zona seleccionada en la pantalla principal

    if (!merchant || !date || !product || isNaN(amount)) {
        alert("Por favor, rellena todos los campos.");
        return;
    }

    const data = {
        level0,
        merchant,
        date,
        product,
        category,
        amount,
        uid: currentUser.uid // IMPORTANTE: Asociar al usuario
    };

    try {
        saveManualDirectBtn.disabled = true;
        saveManualDirectBtn.textContent = "Guardando...";
        
        await addDoc(collection(db, "expenses"), data);
        
        alert("✅ Gasto guardado correctamente en la base de datos.");
        
        // Limpiar y cerrar
        manualMerchant.value = '';
        manualProduct.value = '';
        manualAmount.value = '';
        manualEntryOverlay.style.display = 'none';
    } catch (error) {
        console.error("Error guardando manual:", error);
        alert("Error al guardar: " + error.message);
    } finally {
        saveManualDirectBtn.disabled = false;
        saveManualDirectBtn.textContent = "Guardar en BD";
    }
});

// Cargar configuración al iniciar
// loadConfig(); // Se llama dentro de onAuthStateChanged