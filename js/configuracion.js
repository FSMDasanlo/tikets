import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- FUNCIÓN DE ALERTA PERSONALIZADA ---
function showCustomAlert(message, type = "neutral") {
  let alertBox = document.getElementById("customAlert");
  if (!alertBox) {
    alertBox = document.createElement("div");
    alertBox.id = "customAlert";
    alertBox.className = "custom-alert";
    document.body.appendChild(alertBox);
  }
  alertBox.textContent = message;
  alertBox.className = "custom-alert"; // Reset clases
  if (type === "success") alertBox.classList.add("success");
  if (type === "error") alertBox.classList.add("error");

  void alertBox.offsetWidth; // Forzar reflow
  alertBox.classList.add("show");
  setTimeout(() => alertBox.classList.remove("show"), 2000);
}

// --- FUNCIÓN DE CONFIRMACIÓN PERSONALIZADA ---
function showCustomConfirm(message) {
  return new Promise((resolve) => {
    let modal = document.getElementById("customConfirmModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "customConfirmModal";
      modal.className = "modal-overlay";
      modal.style.zIndex = "99999"; // Prioridad absoluta sobre cualquier otra capa
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

    const msgElement = document.getElementById("confirmMessage");
    const btnYes = document.getElementById("confirmBtnYes");
    const btnNo = document.getElementById("confirmBtnNo");

    msgElement.innerHTML = message.replace(/\n/g, "<br>"); // Permitir saltos de línea

    // 1. Mostrar modal
    modal.style.display = "flex";

    // 2. Forzar reflow
    void modal.offsetWidth;

    // 3. Animar entrada
    modal.classList.add("show");

    // Clonar botones para eliminar eventos anteriores
    const newBtnYes = btnYes.cloneNode(true);
    const newBtnNo = btnNo.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtnYes, btnYes);
    btnNo.parentNode.replaceChild(newBtnNo, btnNo);

    // 4. Enfocar botón Sí
    newBtnYes.focus();

    const closeModal = (result) => {
      modal.classList.remove("show");
      setTimeout(() => {
        modal.style.display = "none";
        resolve(result);
      }, 300);
    };

    newBtnYes.addEventListener("click", () => closeModal(true));
    newBtnNo.addEventListener("click", () => closeModal(false));
  });
}

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAD9gC8MPGCVP89xoFVkJWE0LKStxhCSeQ",
  authDomain: "tikets-e8747.firebaseapp.com",
  projectId: "tikets-e8747",
  storageBucket: "tikets-e8747.firebasestorage.app",
  messagingSenderId: "1011614009578",
  appId: "1:1011614009578:web:b18505cbd4b98e7a6d2f93",
  measurementId: "G-Z3HSTEH6JN",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    const headerUserDisplay = document.getElementById("headerUserDisplay");
    if (headerUserDisplay)
      headerUserDisplay.textContent = `Usuario: ${user.email}`;
    loadCollection("levels", levelsList);
    loadCollection("categories", categoriesList);

    // Mostrar panel de administración solo a Jesus
    // Usamos toLowerCase() para asegurar que coincida aunque haya mayúsculas/minúsculas
    if (
      user.email &&
      user.email.toLowerCase() === "jesus@gmail.com" &&
      adminCard
    ) {
      adminCard.style.display = "block";
    }

    // Mostrar panel de mantenimiento solo para Teresa o Jesus
    if (
      user.email &&
      (user.email.toLowerCase() === "teresa1803@gmail.com" ||
        user.email.toLowerCase() === "jesus@gmail.com")
    ) {
      document.getElementById("maintenanceCard").style.display = "block";
    }
  } else {
    window.location.href = "login.html";
  }
});

console.log("✅ Script configuracion.js cargado.");

// Elementos DOM
const levelsList = document.getElementById("levelsList");
const categoriesList = document.getElementById("categoriesList");
const newLevelInput = document.getElementById("newLevelInput");
const newCategoryInput = document.getElementById("newCategoryInput");
const newCategoryColor = document.getElementById("newCategoryColor");
const addLevelBtn = document.getElementById("addLevelBtn");
const addCategoryBtn = document.getElementById("addCategoryBtn");
const migrateBtn = document.getElementById("migrateBtn");
const fixBankBtn = document.getElementById("fixBankBtn");
const unifyBtn = document.getElementById("unifyBtn");
const adminCard = document.getElementById("adminCard");

// Modal
const configEditModal = document.getElementById("configEditModal");
const modalTitle = document.getElementById("modalTitle");
const editItemId = document.getElementById("editItemId");
const editItemType = document.getElementById("editItemType");
const editItemName = document.getElementById("editItemName");
const editItemColor = document.getElementById("editItemColor");
const colorGroup = document.getElementById("colorGroup");
const saveConfigEditBtn = document.getElementById("saveConfigEditBtn");
const closeConfigEditBtn = document.getElementById("closeConfigEditBtn");

let currentOriginalName = ""; // Para guardar el nombre original antes de editar

// --- FUNCIONES GENÉRICAS ---

async function loadCollection(collectionName, listElement) {
  listElement.innerHTML =
    '<li style="text-align: center; color: #777;">Cargando...</li>';
  try {
    // Usamos consulta simple sin orderBy para evitar errores de índices en Firestore
    // Filtramos por UID
    const q = query(
      collection(db, collectionName),
      where("uid", "==", currentUser.uid),
    );
    const querySnapshot = await getDocs(q);

    listElement.innerHTML = "";

    if (querySnapshot.empty) {
      listElement.innerHTML =
        '<li style="text-align: center; color: #999;">Sin elementos (Lista vacía)</li>';
      return;
    }

    const template = document.getElementById("listItemTemplate");

    // Convertimos a array para ordenar en cliente (más seguro y rápido para listas pequeñas)
    const docs = [];
    querySnapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));

    // Ordenar alfabéticamente
    docs.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    docs.forEach((data) => {
      const clone = template.content.cloneNode(true);

      const nameSpan = clone.querySelector(".item-name");
      nameSpan.textContent = data.name;

      // Si es categoría y tiene color, mostramos un punto
      if (collectionName === "categories" && data.color) {
        const dot = document.createElement("span");
        dot.style.display = "inline-block";
        dot.style.width = "12px";
        dot.style.height = "12px";
        dot.style.backgroundColor = data.color;
        dot.style.borderRadius = "50%";
        dot.style.marginRight = "8px";
        nameSpan.prepend(dot);
      }

      // Botón Editar
      clone.querySelector(".btn-edit").addEventListener("click", () => {
        openEditModal(data.id, data.name, collectionName, data.color);
      });

      // Botón Borrar
      clone.querySelector(".btn-delete").addEventListener("click", () => {
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

  // Convertir a mayúsculas si es Zona para mantener consistencia
  const finalName = collectionName === "levels" ? name.toUpperCase() : name.toLowerCase(); // Normalizar categorías a minúsculas

  try {
    // VALIDACIÓN DE DUPLICADOS
    const q = query(
      collection(db, collectionName),
      where("name", "==", finalName),
      where("uid", "==", currentUser.uid),
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      showCustomAlert(`El elemento "${finalName}" ya existe.`, "error");
      return;
    }

    const data = { name: finalName, uid: currentUser.uid };

    // Si es categoría, guardamos el color
    if (collectionName === "categories" && newCategoryColor) {
      data.color = newCategoryColor.value;
    }

    await addDoc(collection(db, collectionName), data);
    inputElement.value = "";
    loadCollection(collectionName, listElement); // Recargar lista
  } catch (error) {
    console.error("Error añadiendo:", error);
    showCustomAlert("Error al añadir: " + error.message, "error");
  }
}

async function deleteItem(id, name, collectionName, listElement) {
  // COMPROBACIÓN DE USO (Solo para categorías)
  if (collectionName === "categories") {
    try {
      // Consultamos si hay gastos que usen esta categoría
      const q = query(
        collection(db, "expenses"),
        where("category", "==", name.toLowerCase()), // Comparar en minúsculas
        where("uid", "==", currentUser.uid),
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        showCustomAlert(
          `⚠️ Categoría en uso (${snapshot.size} tickets). No se puede borrar.`,
          "error",
        );
        return; // Cancelamos el borrado
      }
    } catch (error) {
      console.error("Error verificando uso de categoría:", error);
      showCustomAlert("Error al verificar uso. Revisa consola.", "error");
      return;
    }
  }

  if (!(await showCustomConfirm(`¿Seguro que quieres eliminar "${name}"?`)))
    return;

  try {
    await deleteDoc(doc(db, collectionName, id));
    loadCollection(collectionName, listElement);
  } catch (error) {
    console.error("Error borrando:", error);
    showCustomAlert("Error al borrar: " + error.message, "error");
  }
}

// --- MODAL DE EDICIÓN ---

function openEditModal(id, currentName, type, currentColor) {
  currentOriginalName = currentName;
  editItemId.value = id;
  editItemName.value = currentName;
  editItemType.value = type; // 'levels' o 'categories'

  modalTitle.textContent =
    type === "levels" ? "Editar Zona" : "Editar Categoría";

  // Mostrar/Ocultar campo de color
  if (type === "categories") {
    colorGroup.style.display = "block";
    if (editItemColor) editItemColor.value = currentColor || "#007bff";
  } else {
    colorGroup.style.display = "none";
  }

  configEditModal.style.display = "flex";
}

saveConfigEditBtn.addEventListener("click", async () => {
  const id = editItemId.value;
  const type = editItemType.value;
  const newName = editItemName.value.trim();

  if (!newName) return;

  const finalName = type === "levels" ? newName.toUpperCase() : newName.toLowerCase(); // Normalizar categorías a minúsculas
  const updateData = { name: finalName };

  if (type === "categories" && editItemColor) {
    updateData.color = editItemColor.value;
  }

  try {
    const docRef = doc(db, type, id);
    await updateDoc(docRef, updateData);

    // Si es una categoría y el nombre ha cambiado, actualizamos los tickets asociados
    if (type === "categories" && finalName !== currentOriginalName) {
      const q = query(
        collection(db, "expenses"),
        where("category", "==", currentOriginalName.toLowerCase()), // Comparar en minúsculas
        where("uid", "==", currentUser.uid),
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
          batch.update(doc.ref, { category: finalName });
        });
        await batch.commit();
        showCustomAlert(
          `✅ Categoría actualizada en ${querySnapshot.size} tickets.`,
          "success",
        );
      }
    }

    configEditModal.style.display = "none";
    // Recargar la lista correspondiente
    if (type === "levels") loadCollection("levels", levelsList);
    else loadCollection("categories", categoriesList);
  } catch (error) {
    console.error("Error actualizando:", error);
    showCustomAlert("Error al actualizar: " + error.message, "error");
  }
});

closeConfigEditBtn.addEventListener("click", () => {
  configEditModal.style.display = "none";
});

// --- EVENT LISTENERS ---

if (addLevelBtn) {
  addLevelBtn.addEventListener("click", () => {
    addItem(newLevelInput, "levels", levelsList);
  });
}

if (addCategoryBtn) {
  addCategoryBtn.addEventListener("click", () => {
    addItem(newCategoryInput, "categories", categoriesList);
  });
}

// Permitir añadir con tecla Enter
if (newLevelInput) {
  newLevelInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addItem(newLevelInput, "levels", levelsList);
  });
}

if (newCategoryInput) {
  newCategoryInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter")
      addItem(newCategoryInput, "categories", categoriesList);
  });
}

// --- MIGRACIÓN DE DATOS ---
if (migrateBtn) {
  migrateBtn.addEventListener("click", async () => {
    if (
      !(await showCustomConfirm(
        "⚠️ ATENCIÓN ⚠️\n\nEsta acción buscará TODOS los gastos, categorías y zonas que NO tengan dueño y los asignará a TU usuario actual.\n\n¿Quieres continuar?",
      ))
    ) {
      return;
    }

    migrateBtn.disabled = true;
    migrateBtn.textContent = "Procesando...";

    try {
      const collections = ["expenses", "levels", "categories"];
      let totalUpdated = 0;

      for (const colName of collections) {
        // Obtenemos TODOS los documentos de la colección
        const snapshot = await getDocs(collection(db, colName));

        for (const docSnap of snapshot.docs) {
          // Si no tiene UID, es un dato antiguo -> Lo actualizamos
          if (!docSnap.data().uid) {
            await updateDoc(docSnap.ref, { uid: currentUser.uid });
            totalUpdated++;
          }
        }
      }

      showCustomAlert(
        `✅ Migración completada. ${totalUpdated} registros asignados.`,
        "success",
      );
      // Recargar la página para ver los cambios
      location.reload();
    } catch (error) {
      console.error("Error en migración:", error);
      showCustomAlert("Error en migración: " + error.message, "error");
      migrateBtn.disabled = false;
      migrateBtn.textContent = "Importar Datos Antiguos";
    }
  });
}

// --- UNIFICAR DATOS DE GASTOS ---
if (unifyBtn) {
  unifyBtn.addEventListener("click", async () => {
    const originalText = unifyBtn.textContent;
    const unifyTypes = {
      product: { label: "Conceptos", singular: "concepto", field: "product" },
      merchant: { label: "Comercios", singular: "comercio", field: "merchant" },
      category: { label: "Categorías", singular: "categoría", field: "category" },
    };
    const selectedType = unifyTypes[document.getElementById("unifyType").value];
    try {
      unifyBtn.disabled = true;
      unifyBtn.textContent = `Cargando ${selectedType.label.toLowerCase()}...`;

      // 1. Obtener todos los gastos para extraer los valores únicos del campo elegido
      const q = query(collection(db, "expenses"), where("uid", "==", currentUser.uid));
      const querySnapshot = await getDocs(q);
      const valueCounts = {};

      querySnapshot.forEach((docSnap) => {
        const value = (docSnap.data()[selectedType.field] || "").trim();
        if (value) {
          valueCounts[value] = (valueCounts[value] || 0) + 1;
        }
      });

      const sortedValues = Object.keys(valueCounts).sort();

      if (sortedValues.length === 0) {
        showCustomAlert(`No se encontraron ${selectedType.label.toLowerCase()} para unificar.`, "neutral");
        return;
      }

      // 2. Crear y mostrar modal dinámico de unificación
      let modal = document.getElementById("unifyConceptsModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "unifyConceptsModal";
        modal.className = "modal-overlay";
        modal.style.zIndex = "10000";
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; max-height: 85vh; display: flex; flex-direction: column;">
          <h2 style="margin-top: 0;">Unificar ${selectedType.label}</h2>
            <p style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">
            Selecciona los ${selectedType.label.toLowerCase()} que quieres renombrar masivamente:
            </p>
            
            <div style="flex: 1; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 5px; margin-bottom: 15px; text-align: left; background: #fafafa;">
            ${sortedValues.map(value => `
                    <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer; font-size: 0.95rem; padding: 4px; border-radius: 4px;">
                <input type="checkbox" class="unify-item" value="${value}" style="width: auto; margin: 0;"> 
                <span>${value} <small style="color: #999;">(${valueCounts[value]} registros)</small></span>
                    </label>
                `).join("")}
            </div>

            <div class="form-group">
            <label>Nuevo nombre unificado:</label>
            <input type="text" id="targetUnifyName" placeholder="Nombre final">
            </div>

            <div class="modal-actions">
                <button id="confirmUnifyBtn" class="btn-save" style="background-color: #6f42c1;">Procesar Cambio</button>
                <button id="cancelUnifyBtn" class="btn-close">Cancelar</button>
            </div>
        </div>
      `;

      modal.style.visibility = "visible";
      modal.style.opacity = "1";
      modal.style.display = "flex";
      void modal.offsetWidth;
      modal.classList.add("show");

      const closeUnifyModal = () => {
        modal.classList.remove("show");
        setTimeout(() => {
          modal.style.display = "none";
          modal.style.visibility = "";
          modal.style.opacity = "";
        }, 300);
      };

      document.getElementById("cancelUnifyBtn").onclick = closeUnifyModal;
      document.getElementById("confirmUnifyBtn").onclick = async () => {
        const selected = Array.from(modal.querySelectorAll(".unify-item:checked")).map(cb => cb.value);
        const newName = document.getElementById("targetUnifyName").value.trim();
        const finalName = selectedType.field === "category" ? newName.toLowerCase() : newName;

        if (selected.length < 2) { showCustomAlert(`Selecciona al menos 2 ${selectedType.label.toLowerCase()}.`, "error"); return; }
        if (!newName) { showCustomAlert("Escribe el nombre final.", "error"); return; }

        // Ocultar temporalmente este modal para que se vea bien la confirmación
        modal.style.visibility = "hidden";
        modal.style.opacity = "0";

        const confirmed = await showCustomConfirm(`¿Seguro que quieres unificar estos ${selected.length} ${selectedType.label.toLowerCase()} en "${finalName}"?`);
        
        if (!confirmed) {
            modal.style.visibility = "visible";
            modal.style.opacity = "1";
            return;
        }

        closeUnifyModal();
        unifyBtn.disabled = true;

        try {
          let targetCategory = null;
          if (selectedType.field === "product") {
            const categoryCounts = {};
            querySnapshot.docs.forEach(docSnap => {
              const data = docSnap.data();
              const product = (data.product || "").trim();
              if (selected.includes(product)) {
                const category = (data.category || "").toLowerCase();
                if (category) categoryCounts[category] = (categoryCounts[category] || 0) + 1;
              }
            });
            const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
            targetCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : null;
          }

          let batch = writeBatch(db);
          let count = 0;
          let totalUpdated = 0;

          for (const oldName of selected) {
            const docsToUpdate = querySnapshot.docs.filter(
              docSnap => (docSnap.data()[selectedType.field] || "").trim() === oldName,
            );
            for (const docSnap of docsToUpdate) {
              const updateData = { [selectedType.field]: finalName };
              if (targetCategory) updateData.category = targetCategory;
              
              batch.update(docSnap.ref, updateData);
              count++; totalUpdated++;
              if (count >= 450) { await batch.commit(); batch = writeBatch(db); count = 0; }
            }
          }
          if (count > 0) await batch.commit();

          if (selectedType.field === "category") {
            const categoriesSnapshot = await getDocs(
              query(collection(db, "categories"), where("uid", "==", currentUser.uid)),
            );
            const categoryDocs = categoriesSnapshot.docs.filter(docSnap =>
              selected.includes((docSnap.data().name || "").trim()),
            );
            const destinationDoc = categoriesSnapshot.docs.find(
              docSnap => (docSnap.data().name || "").trim() === finalName,
            );
            const categoryBatch = writeBatch(db);
            const categoryToKeep = destinationDoc || categoryDocs[0];

            if (categoryToKeep && !destinationDoc) {
              categoryBatch.update(categoryToKeep.ref, { name: finalName });
            }
            categoryDocs.forEach(docSnap => {
              if (docSnap.ref.path !== categoryToKeep?.ref.path) {
                categoryBatch.delete(docSnap.ref);
              }
            });
            if (categoryToKeep) await categoryBatch.commit();
            loadCollection("categories", categoriesList);
          }

          unifyBtn.textContent = originalText;
          showCustomAlert(`✅ Éxito: ${totalUpdated} registros actualizados.`, "success");
        } catch (err) {
          console.error(err); showCustomAlert("Error al actualizar registros.", "error");
        } finally {
          unifyBtn.disabled = false;
          unifyBtn.textContent = originalText;
        }
      };
    } catch (error) { 
        console.error(error); 
      showCustomAlert(`Error al procesar ${selectedType.label.toLowerCase()}.`, "error");
        unifyBtn.disabled = false;
        unifyBtn.textContent = originalText;
    }
  });
}

// --- REPARAR BANCOS VACÍOS (SCRIPT TEMPORAL) ---
if (fixBankBtn) {
  fixBankBtn.addEventListener("click", async () => {
    if (
      !(await showCustomConfirm(
        "¿Quieres rellenar con 'CAIXA' todos tus gastos que no tengan banco asignado?",
      ))
    )
      return;

    fixBankBtn.disabled = true;
    fixBankBtn.textContent = "Procesando...";

    try {
      // Buscamos todos los gastos del usuario actual
      const q = query(
        collection(db, "expenses"),
        where("uid", "==", currentUser.uid),
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Si el campo banco no existe, es null o está vacío, lo marcamos para actualizar
        if (!data.bank || data.bank.trim().toUpperCase() === "") { 
          batch.update(docSnap.ref, { bank: "CAIXA" }); 
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        showCustomAlert(
          `✅ ¡Listo! Se han actualizado ${count} apuntes con el banco 'CAIXA'.`,
          "success",
        );
      } else {
        showCustomAlert(
          "No se han encontrado apuntes con el banco vacío.",
          "neutral",
        );
      }
    } catch (error) {
      console.error("Error al reparar bancos:", error);
      showCustomAlert("Error: " + error.message, "error");
    } finally {
      fixBankBtn.disabled = false;
      fixBankBtn.textContent = "Reparar Bancos Vacíos";
    }
  });
}

// --- INICIALIZACIÓN ---

// Cargar datos al iniciar
// loadCollection... // Se llama en onAuthStateChanged
