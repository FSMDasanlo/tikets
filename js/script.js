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
const saveDbBtn = document.getElementById('saveDbBtn');
const globalMerchantInput = document.getElementById('globalMerchant');
const globalDateInput = document.getElementById('globalDate');

// Función para limpiar la tabla y los datos
function clearTable() {
    ticketsTableBody.innerHTML = '';
    globalMerchantInput.value = '';
    globalDateInput.value = '';
    tableTotalSpan.textContent = '0.00 €';
    statusMessage.textContent = 'Esperando imagen...';
    statusMessage.style.color = '#333';
}

// Función para guardar datos (Simulación BD)
function saveDataToDb() {
    const rows = document.querySelectorAll('#ticketsTable tbody tr');
    if (rows.length === 0) return;

    const merchant = globalMerchantInput.value.trim();
    const date = globalDateInput.value.trim();

    if (!merchant || !date) {
        alert("Por favor, rellena el Comercio y la Fecha antes de guardar.");
        return;
    }

    const dataToSave = [];

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const categorySelect = row.querySelector('.category-select');
        dataToSave.push({
            merchant: merchant,
            date: date,
            product: cells[0].innerText,
            category: categorySelect.value,
            amount: cells[2].innerText
        });
    });

    console.log("Guardando en BD:", dataToSave);
    alert(`Se han guardado ${dataToSave.length} registros en la base de datos.`);
    
    clearTable();
}

async function processFile(file) {
    if (!file) return;

    // Comprobar si hay datos sin guardar
    if (ticketsTableBody.children.length > 0) {
        const wantToSave = confirm("Hay datos de un ticket anterior sin guardar.\n\n¿Quieres GUARDARLOS antes de procesar el nuevo?\n\n[Aceptar] = Guardar y continuar\n[Cancelar] = No guardar (Borrar) y continuar");
        
        if (wantToSave) {
            saveDataToDb();
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
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const page = await pdf.getPage(1); // Solo leemos la página 1
            
            // Renderizamos a alta calidad (escala 2) para que el OCR lea bien
            const viewport = page.getViewport({ scale: 2.0 }); 
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
        const dateFound = dateMatch ? dateMatch[0] : "No detectada";

        // Buscar líneas que parezcan items (Texto ... Precio)
        const lines = text.split('\n');
        const priceRegex = /(\d+[.,]\d{2})\s*€?/; // Busca números con decimales

        const merchantFound = lines[0] || "No detectado";

        // Rellenamos los campos globales (fuera de la tabla)
        globalMerchantInput.value = merchantFound;
        globalDateInput.value = dateFound;

        let itemsFoundCount = 0;
        lines.forEach(line => {
            // Si la línea tiene un precio y texto largo, probablemente es un item
            if (priceRegex.test(line) && line.length > 5) {
                const priceMatch = line.match(priceRegex);
                const price = priceMatch[0];
                const desc = line.replace(price, '').replace('€', '').trim();
                
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
function addTableRow(product, price) {
    const row = document.createElement('tr');
    
    // Intentamos adivinar la categoría
    const guessedCategory = guessCategory(product);

    // Celdas editables
    row.innerHTML = `
        <td contenteditable="true">${product}</td>
        <td>
            <select class="category-select">
                <option value="Alimentación" ${guessedCategory === 'Alimentación' ? 'selected' : ''}>Alimentación</option>
                <option value="Ropa" ${guessedCategory === 'Ropa' ? 'selected' : ''}>Ropa</option>
                <option value="Ocio" ${guessedCategory === 'Ocio' ? 'selected' : ''}>Ocio</option>
                <option value="Comunidades" ${guessedCategory === 'Comunidades' ? 'selected' : ''}>Comunidades</option>
                <option value="Seguros" ${guessedCategory === 'Seguros' ? 'selected' : ''}>Seguros</option>
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