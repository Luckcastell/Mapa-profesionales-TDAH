
const TIPOS_CENTRO = [
  "centro de integracion",
  "centro clinica de profecionales",
  "centro de terapias",
];
const ESPECIALIDADES = [
  "psicologo psicoanalista",
  "psicologo TCC",
  "psicopedagogo",
  "terapia ocupacional",
  "pediatra",
  "pediatra de neurodesarrollo",
  "psiquiatra",
  "neurologo",
  "coaching",
  "apoyo escolar",
];
const POBLACIONES = ["infanto-juvenil", "adultos"];

let datos = [];
let idEditando = null;

const el = {
  formulario: document.getElementById("formularioItem"),
  errores: document.getElementById("erroresFormulario"),
  campoId: document.getElementById("campoId"),
  campoNombre: document.getElementById("campoNombre"),
  campoEsCentro: document.getElementById("campoEsCentro"),
  campoTipoCentro: document.getElementById("campoTipoCentro"),
  grupoEspecialidades: document.getElementById("grupoEspecialidades"),
  grupoPoblacion: document.getElementById("grupoPoblacion"),
  campoZona: document.getElementById("campoZona"),
  campoLat: document.getElementById("campoLat"),
  campoLng: document.getElementById("campoLng"),
  campoDireccion: document.getElementById("campoDireccion"),
  campoCiudad: document.getElementById("campoCiudad"),
  campoPais: document.getElementById("campoPais"),
  campoWeb: document.getElementById("campoWeb"),
  campoContacto: document.getElementById("campoContacto"),
  btnNuevo: document.getElementById("btnNuevo"),
  btnEliminar: document.getElementById("btnEliminar"),
  lista: document.getElementById("listaFormulario"),
  conteo: document.getElementById("conteoFormulario"),
};

function uid(){ return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
const normalizar = (t) => (t || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

function valoresChequeados(contenedor) {
  return Array.from(contenedor.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);
}
function setChequeados(contenedor, valores) {
  Array.from(contenedor.querySelectorAll("input[type=checkbox]")).forEach(c => c.checked = valores.includes(c.value));
}

function construirUI() {
  el.campoTipoCentro.innerHTML = `<option value="">— Seleccionar —</option>` + TIPOS_CENTRO.map(ct => `<option value="${ct}">${ct}</option>`).join("");
  el.grupoEspecialidades.innerHTML = ESPECIALIDADES.map(sp => `<label><input type="checkbox" value="${sp}"/> <span class="cap">${sp}</span></label>`).join("");
  el.grupoPoblacion.innerHTML = POBLACIONES.map(p => `<label><input type="checkbox" value="${p}"/> <span class="cap">${p}</span></label>`).join("");

  el.campoEsCentro.addEventListener("change", () => {
    el.campoTipoCentro.disabled = !el.campoEsCentro.checked;
    if (!el.campoEsCentro.checked) el.campoTipoCentro.value = "";
  });

  el.btnNuevo.addEventListener("click", limpiarFormulario);
  el.btnEliminar.addEventListener("click", () => {
    if (!idEditando) { alert("No hay elemento seleccionado."); return; }
    const idx = datos.findIndex(d => d.id === idEditando);
    if (idx >= 0 && confirm("¿Eliminar este ítem?")) {
      datos.splice(idx, 1);
      guardarArchivo();
      limpiarFormulario();
      renderizarLista();
    }
  });

  el.formulario.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = recolectar();
    const errores = validar(item);
    if (errores.length) { mostrarErrores(errores); return; }
    if (idEditando) {
      const idx = datos.findIndex(d => d.id === idEditando);
      if (idx >= 0) datos[idx] = item;
    } else {
      item.id = uid();
      datos.push(item);
    }
    guardarArchivo();
    limpiarFormulario();
    renderizarLista();
    alert("Guardado.");
  });
}

function recolectar() {
  const item = {
    id: idEditando || uid(),
    nombre: el.campoNombre.value.trim(),
    esCentro: !!el.campoEsCentro.checked,
    tipoCentro: el.campoEsCentro.checked ? (el.campoTipoCentro.value || "") : undefined,
    especialidades: valoresChequeados(el.grupoEspecialidades),
    poblacion: valoresChequeados(el.grupoPoblacion),
    zona: el.campoZona.value.trim() || undefined,
    coords: (isFinite(parseFloat(el.campoLat.value)) && isFinite(parseFloat(el.campoLng.value))) ? { lat: parseFloat(el.campoLat.value), lng: parseFloat(el.campoLng.value) } : undefined,
    direccion: el.campoDireccion.value.trim() || undefined,
    ciudad: el.campoCiudad.value.trim() || undefined,
    pais: el.campoPais.value.trim() || undefined,
    web: el.campoWeb.value.trim() || undefined,
    contacto: el.campoContacto.value.trim() || undefined,
  };
  return item;
}

function validar(i) {
  const errs = [];
  if (!i.nombre) errs.push("El nombre es obligatorio.");
  if (!i.coords) errs.push("Debés indicar lat y lng.");
  if (!i.especialidades || i.especialidades.length === 0) errs.push("Seleccioná al menos una especialidad.");
  if (!i.poblacion || i.poblacion.length === 0) errs.push("Seleccioná al menos una población.");
  if (i.esCentro && !i.tipoCentro) errs.push("Si es un centro, el tipo de centro es obligatorio.");
  if (i.coords) {
    const { lat, lng } = i.coords;
    if (lat < -90 || lat > 90) errs.push("Lat debe estar entre -90 y 90.");
    if (lng < -180 || lng > 180) errs.push("Lng debe estar entre -180 y 180.");
  }
  return errs;
}

function mostrarErrores(msgs) {
  if (!msgs.length) { el.errores.hidden = true; el.errores.innerHTML = ""; return; }
  el.errores.hidden = false;
  el.errores.innerHTML = "<ul>" + msgs.map(m => `<li>${m}</li>`).join("") + "</ul>";
}

function limpiarFormulario() {
  idEditando = null;
  el.campoId.value = "";
  el.campoNombre.value = "";
  el.campoEsCentro.checked = false;
  el.campoTipoCentro.value = "";
  el.campoTipoCentro.disabled = true;
  setChequeados(el.grupoEspecialidades, []);
  setChequeados(el.grupoPoblacion, []);
  el.campoZona.value = "";
  el.campoLat.value = "";
  el.campoLng.value = "";
  el.campoDireccion.value = "";
  el.campoCiudad.value = "";
  el.campoPais.value = "";
  el.campoWeb.value = "";
  el.campoContacto.value = "";
  mostrarErrores([]);
}

function cargarDatos() {
  return fetch("data.json", { cache: "no-store" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
    .then(arr => { datos = Array.isArray(arr) ? arr : []; })
    .catch(() => { datos = window.__FALLBACK__ || []; });
}

function renderizarLista() {
  el.conteo.textContent = datos.length;
  el.lista.innerHTML = datos.map(d => {
    const ciudad = [d.zona || [d.ciudad, d.pais].filter(Boolean).join(", ")].filter(Boolean).join("");
    return `
      <div class="fila">
        <div class="titulo"><span>${d.nombre}</span><span class="etiqueta">${d.esCentro ? "Centro" : "Prof."}</span></div>
        <div class="meta">${ciudad}</div>
        <div>
          <button class="btn secundario btn-small" data-editar="${d.id}">Editar</button>
        </div>
      </div>
    `;
  }).join("");

  el.lista.querySelectorAll("[data-editar]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-editar");
      const it = datos.find(x => x.id === id);
      if (it) cargarFormulario(it);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function cargarFormulario(it) {
  idEditando = it.id;
  el.campoId.value = it.id;
  el.campoNombre.value = it.nombre || "";
  el.campoEsCentro.checked = !!it.esCentro;
  el.campoTipoCentro.disabled = !it.esCentro;
  el.campoTipoCentro.value = it.tipoCentro || "";
  setChequeados(el.grupoEspecialidades, it.especialidades || []);
  setChequeados(el.grupoPoblacion, it.poblacion || []);
  el.campoZona.value = it.zona || "";
  el.campoLat.value = it.coords?.lat ?? "";
  el.campoLng.value = it.coords?.lng ?? "";
  el.campoDireccion.value = it.direccion || "";
  el.campoCiudad.value = it.ciudad || "";
  el.campoPais.value = it.pais || "";
  el.campoWeb.value = it.web || "";
  el.campoContacto.value = it.contacto || "";
  mostrarErrores([]);
}

function guardarArchivo() {
  const contenido = JSON.stringify(datos, null, 2);
  const blob = new Blob([contenido], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

window.addEventListener("DOMContentLoaded", async () => {
  window.__FALLBACK__ = [{"id": "1", "nombre": "Centro Andares", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["psicopedagogo", "terapia ocupacional", "psicologo TCC"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.6037, "lng": -58.3816}, "direccion": "Av. Corrientes 1000", "ciudad": "CABA", "pais": "Argentina", "zona": "Flores, CABA, Argentina", "web": "https://ejemplo.org/andares", "contacto": "+54 11 5555-1111"}, {"id": "2", "nombre": "Clínica Norte", "esCentro": true, "tipoCentro": "centro clinica de profecionales", "especialidades": ["psiquiatra", "psicologo psicoanalista"], "poblacion": ["adultos", "infanto-juvenil"], "coords": {"lat": 4.711, "lng": -74.0721}, "direccion": "Cra 7 # 12-34", "ciudad": "Bogotá", "pais": "Colombia", "zona": "Bogotá, Colombia"}, {"id": "3", "nombre": "Dra. María López", "esCentro": false, "especialidades": ["pediatra", "pediatra de neurodesarrollo"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -33.4489, "lng": -70.6693}, "ciudad": "Santiago", "pais": "Chile", "zona": "Santiago, Chile", "contacto": "+56 2 2222-3333"}, {"id": "4", "nombre": "NeuroCentro Madrid", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["neurologo", "psiquiatra"], "poblacion": ["adultos"], "coords": {"lat": 40.4168, "lng": -3.7038}, "ciudad": "Madrid", "pais": "España", "zona": "Madrid, España", "web": "https://ejemplo.org/neurocentro"}, {"id": "5", "nombre": "Apoyo Escolar Retiro", "esCentro": false, "especialidades": ["apoyo escolar", "coaching"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.5918, "lng": -58.3817}, "ciudad": "CABA", "pais": "Argentina", "zona": "Retiro, CABA, Argentina"}, {"id": "6", "nombre": "Therapy Hub NYC", "esCentro": true, "tipoCentro": "centro de terapias", "especialidades": ["psicologo TCC", "terapia ocupacional"], "poblacion": ["adultos", "infanto-juvenil"], "coords": {"lat": 40.7128, "lng": -74.006}, "ciudad": "Washington DC", "pais": "EEUU", "zona": "Washington DC, EEUU"}, {"id": "7", "nombre": "Dr. João Pereira", "esCentro": false, "especialidades": ["neurologo"], "poblacion": ["adultos"], "coords": {"lat": -23.5505, "lng": -46.6333}, "ciudad": "São Paulo", "pais": "Brasil", "zona": "São Paulo, Brasil"}, {"id": "8", "nombre": "Centro Horizonte Lima", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["psicopedagogo", "psicologo psicoanalista"], "poblacion": ["infanto-juvenil", "adultos"], "coords": {"lat": -12.0464, "lng": -77.0428}, "ciudad": "Lima", "pais": "Perú", "zona": "Lima, Perú"}, {"id": "9", "nombre": "Dra. Ana Gómez", "esCentro": false, "especialidades": ["psicologo psicoanalista"], "poblacion": ["adultos"], "coords": {"lat": 41.3851, "lng": 2.1734}, "ciudad": "Barcelona", "pais": "España", "zona": "Barcelona, España"}, {"id": "10", "nombre": "Centro Infantil Montevideo", "esCentro": true, "tipoCentro": "centro de terapias", "especialidades": ["terapia ocupacional", "psicopedagogo"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.9011, "lng": -56.1645}, "ciudad": "Montevideo", "pais": "Uruguay", "zona": "Montevideo, Uruguay"}];
  construirUI();
  await cargarDatos();
  renderizarLista();
});
