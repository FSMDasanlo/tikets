import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

console.log("✅ Script configuracion.js cargado.");

// Elementos DOM
const levelsList = document.getElementById('levelsList');
const categoriesList = document.getElementById('categoriesList');
const newLevelInput = document.getElementById('newLevelInput');
const newCategoryInput = document.getElementById('newCategoryInput');
const newCategoryColor = document.getElementById('newCategoryColor');
const addLevelBtn = document.getElementById('addLevelBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');

// Modal
const configEditModal = document.getElementById('configEditModal');
const modalTitle = document.getElementById('modalTitle');
const editItemId = document.getElementById('editItemId');
const editItemType = document.getElementById('editItemType');
const editItemName = document.getElementById('editItemName');
const editItemColor = document.getElementById('editItemColor');
const colorGroup = document.getElementById('colorGroup');
const saveConfigEditBtn = document.getElementById('saveConfigEditBtn');
const closeConfigEditBtn = document.getElementById('closeConfigEditBtn');

let currentOriginalName = ''; // Para guardar el nombre original antes de editar

// --- FUNCIONES GENÉRICAS ---

async function loadCollection(collectionName, listElement) {
    listElement.innerHTML = '<li style="text-align: center; color: #777;">Cargando...</li>';
    try {
        // Usamos consulta simple sin orderBy para evitar errores de índices en Firestore
        const q = collection(db, collectionName);
        const querySnapshot = await getDocs(q);
        
        listElement.innerHTML = '';
        
        if (querySnapshot.empty) {
            listElement.innerHTML = '<li style="text-align: center; color: #999;">Sin elementos (Lista vacía)</li>';
            return;
        }

        const template = document.getElementById('listItemTemplate');
        
        // Convertimos a array para ordenar en cliente (más seguro y rápido para listas pequeñas)
        const docs = [];
        querySnapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
        
        // Ordenar alfabéticamente
        docs.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        docs.forEach((data) => {
            const clone = template.content.cloneNode(true);
            
            const nameSpan = clone.querySelector('.item-name');
            nameSpan.textContent = data.name;

            // Si es categoría y tiene color, mostramos un punto
            if (collectionName === 'categories' && data.color) {
                const dot = document.createElement('span');
                dot.style.display = 'inline-block';
                dot.style.width = '12px';
                dot.style.height = '12px';
                dot.style.backgroundColor = data.color;
                dot.style.borderRadius = '50%';
                dot.style.marginRight = '8px';
                nameSpan.prepend(dot);
            }
            
            // Botón Editar
            clone.querySelector('.btn-edit').addEventListener('click', () => {
                openEditModal(data.id, data.name, collectionName, data.color);
            });

            // Botón Borrar
            clone.querySelector('.btn-delete').addEventListener('click', () => {
                // Pasamos también el nombre para comprobar uso
                deleteItem(data.id, data.name, collectionName, listElement);
            });

            listElement.appendChild(clone);
        });

    } catch (error) {
        console.error(`Error cargando ${collectionName}:`, error);
        listElement.innerHTML = `<li style="color: red;">Error: ${error.message}</li>`;
    }
}

async function addItem(inputElement, collectionName, listElement) {
    const name = inputElement.value.trim();
    if (!name) return;

    // Convertir a mayúsculas si es Nivel 0 para mantener consistencia
    const finalName = collectionName === 'levels' ? name.toUpperCase() : name;

    try {
        // VALIDACIÓN DE DUPLICADOS
        const q = query(collection(db, collectionName), where("name", "==", finalName));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            alert(`El elemento "${finalName}" ya existe.`);
            return;
        }

        const data = { name: finalName };
        
        // Si es categoría, guardamos el color
        if (collectionName === 'categories' && newCategoryColor) {
            data.color = newCategoryColor.value;
        }

        await addDoc(collection(db, collectionName), data);
        inputElement.value = '';
        loadCollection(collectionName, listElement); // Recargar lista
    } catch (error) {
        console.error("Error añadiendo:", error);
        alert("Error al añadir: " + error.message);
    }
}

async function deleteItem(id, name, collectionName, listElement) {
    // COMPROBACIÓN DE USO (Solo para categorías)
    if (collectionName === 'categories') {
        try {
            // Consultamos si hay gastos que usen esta categoría
            const q = query(collection(db, "expenses"), where("category", "==", name));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                alert(`⚠️ No puedes borrar la categoría "${name}" porque se está usando en ${snapshot.size} tickets.\n\nPor favor, asigna otra categoría a esos tickets antes de borrarla.`);
                return; // Cancelamos el borrado
            }
        } catch (error) {
            console.error("Error verificando uso de categoría:", error);
            alert("Error al verificar si la categoría está en uso. Revisa la consola.");
            return;
        }
    }

    if (!confirm(`¿Seguro que quieres eliminar "${name}"?`)) return;

    try {
        await deleteDoc(doc(db, collectionName, id));
        loadCollection(collectionName, listElement);
    } catch (error) {
        console.error("Error borrando:", error);
        alert("Error al borrar: " + error.message);
    }
}

// --- MODAL DE EDICIÓN ---

function openEditModal(id, currentName, type, currentColor) {
    currentOriginalName = currentName;
    editItemId.value = id;
    editItemName.value = currentName;
    editItemType.value = type; // 'levels' o 'categories'
    
    modalTitle.textContent = type === 'levels' ? 'Editar Nivel 0' : 'Editar Categoría';
    
    // Mostrar/Ocultar campo de color
    if (type === 'categories') {
        colorGroup.style.display = 'block';
        if(editItemColor) editItemColor.value = currentColor || '#007bff';
    } else {
        colorGroup.style.display = 'none';
    }

    configEditModal.style.display = 'flex';
}

saveConfigEditBtn.addEventListener('click', async () => {
    const id = editItemId.value;
    const type = editItemType.value;
    const newName = editItemName.value.trim();

    if (!newName) return;

    const finalName = type === 'levels' ? newName.toUpperCase() : newName;
    const updateData = { name: finalName };

    if (type === 'categories' && editItemColor) {
        updateData.color = editItemColor.value;
    }

    try {
        const docRef = doc(db, type, id);
        await updateDoc(docRef, updateData);

        // Si es una categoría y el nombre ha cambiado, actualizamos los tickets asociados
        if (type === 'categories' && finalName !== currentOriginalName) {
            const q = query(collection(db, "expenses"), where("category", "==", currentOriginalName));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const batch = writeBatch(db);
                querySnapshot.forEach(doc => {
                    batch.update(doc.ref, { category: finalName });
                });
                await batch.commit();
                alert(`✅ Categoría actualizada. Se han modificado ${querySnapshot.size} tickets que la usaban.`);
            }
        }
        
        configEditModal.style.display = 'none';
        // Recargar la lista correspondiente
        if (type === 'levels') loadCollection('levels', levelsList);
        else loadCollection('categories', categoriesList);

    } catch (error) {
        console.error("Error actualizando:", error);
        alert("Error al actualizar: " + error.message);
    }
});

closeConfigEditBtn.addEventListener('click', () => {
    configEditModal.style.display = 'none';
});

// --- EVENT LISTENERS ---

if (addLevelBtn) {
    addLevelBtn.addEventListener('click', () => {
        addItem(newLevelInput, 'levels', levelsList);
    });
}

if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
        addItem(newCategoryInput, 'categories', categoriesList);
    });
}

// Permitir añadir con tecla Enter
if (newLevelInput) {
    newLevelInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem(newLevelInput, 'levels', levelsList);
    });
}

if (newCategoryInput) {
    newCategoryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem(newCategoryInput, 'categories', categoriesList);
    });
}

// --- INICIALIZACIÓN ---

// Cargar datos al iniciar
loadCollection('levels', levelsList);
loadCollection('categories', categoriesList);
