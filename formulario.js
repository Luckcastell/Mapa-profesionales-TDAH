/** 
 * Formulario de alta/edición de ítems
 * Proyecto: Red de Profesionales
 * Descripción: Funcion del form para ingresar datos. Explica el propósito de cada bloque y función.
 * Generado: 2025-08-15 09:29
 */

// Opciones de tipo de centro para el selector
const TIPOS_CENTRO = [
  "centro de integracion",
  "centro clinica de profecionales",
  "centro de terapias",
];
// Opciones de especialidades (checkboxes)
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
// Poblaciones objetivo (checkboxes)
const POBLACIONES = ["infanto-juvenil", "adultos"];



function mapaPaisACodigo(paisTexto){
  const p = (paisTexto||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"");
  if (p.includes("argentin")) return "ar";
  if (p.includes("espana") || p.includes("espa\u00f1a")) return "es";
  if (p.includes("eeuu") || p.includes("estados unidos") || p.includes("usa") || p.includes("united states")) return "us";
  if (p.includes("brasil")) return "br";
  if (p.includes("peru")) return "pe";
  if (p.includes("uruguay")) return "uy";
  if (p.includes("chile")) return "cl";
  if (p.includes("colombia")) return "co";
  return "";
}

async function obtenerViewboxParaZona(zona, ciudad, pais){
  const q = [zona, ciudad, pais].filter(Boolean).join(", ");
  if(!q) return null;
  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=" + encodeURIComponent(q);
  const r = await fetch(url, { headers: {"Accept":"application/json"} });
  if(!r.ok) return null;
  const arr = await r.json();
  if(!Array.isArray(arr) || !arr.length) return null;
  const bb = arr[0].boundingbox; // [south, north, west, east] as strings
  if(!bb || bb.length !== 4) return null;
  return { south: parseFloat(bb[0]), north: parseFloat(bb[1]), west: parseFloat(bb[2]), east: parseFloat(bb[3]) };
}

function construirConsultaEstructurada(){
  const direccion = elementos.campoDireccion?.value?.trim() || "";
  const ciudad = elementos.campoCiudad?.value?.trim() || "";
  const pais = elementos.campoPais?.value?.trim() || "";
  const zona = elementos.campoZona?.value?.trim() || "";
  const params = new URLSearchParams({ format:"jsonv2", addressdetails:"1", limit:"10" });
  const countryCode = mapaPaisACodigo(pais);
  if (countryCode) params.set("countrycodes", countryCode);
  if (direccion) params.set("street", direccion);
  if (ciudad) params.set("city", ciudad);
  if (pais) params.set("country", pais);
  // fallback simple 'q' if no structured fields
  if (!direccion && !ciudad && !pais && zona) params.set("q", zona);
  return { params, zona, ciudad, pais };
}

function puntuarResultado(it, direccion){
  let score = 0;
  const tipo = (it.type||"");
  if (tipo === "house" || tipo === "residential" || tipo==="building") score += 3;
  if (it.address && it.address.house_number) score += 3;
  const road = (it.address && (it.address.road||it.address.pedestrian||it.address.footway||"")).toLowerCase();
  if (direccion && road && direccion.toLowerCase().includes(road)) score += 2;
  if (it.importance) score += Math.min(2, it.importance);
  return score;
}

/** Geocodifica con búsqueda estructurada + viewbox + heurística de mejor resultado */
async function geocodificarDireccionMejorada(){
  const dir = elementos.campoDireccion?.value?.trim() || "";
  const { params, zona, ciudad, pais } = construirConsultaEstructurada();
  // Bias por zona (viewbox) si existe
  const vb = await obtenerViewboxParaZona(zona, ciudad, pais).catch(()=>null);
  if (vb){
    // Nominatim viewbox expects: left, top, right, bottom
    params.set("viewbox", `${vb.west},${vb.north},${vb.east},${vb.south}`);
    params.set("bounded", "1");
  }
  const url = "https://nominatim.openstreetmap.org/search?" + params.toString();
  const r = await fetch(url, { headers: {"Accept":"application/json","Accept-Language":"es"} });
  if (!r.ok) throw new Error("HTTP "+r.status);
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) throw new Error("Sin resultados");
  // Elegimos el mejor por puntuación
  let mejor = arr[0], mejorScore = -1;
  for(const it of arr){
    const sc = puntuarResultado(it, dir);
    if (sc > mejorScore){ mejor = it; mejorScore = sc; }
  }
  return { lat: parseFloat(mejor.lat), lng: parseFloat(mejor.lon) };
}

async function geocodificarDireccion(texto){
  // compatible wrapper
  return geocodificarDireccionMejorada();
}


function debounce(fn, delay){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); }; }

/** Autocompletado: obtiene sugerencias de direcciones a medida que se escribe */
async function buscarSugerenciasDireccion(q){
  const url = "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=" + encodeURIComponent(q);
  const resp = await fetch(url, { headers: {"Accept":"application/json"} });
  if(!resp.ok) throw new Error("HTTP "+resp.status);
  return await resp.json();
}

/** Renderiza el cuadro de sugerencias y maneja su selección */
function mostrarSugerencias(lista){
  const box = document.getElementById("sugerenciasGeocodificar");
  if(!box) return;
  if(!lista || !lista.length){ box.innerHTML=""; box.style.display="none"; return; }
  box.style.display="block";
  box.innerHTML = lista.map((it,idx)=>{
    const titulo = (it.display_name || "").split(",").slice(0,3).join(", ");
    const full = it.display_name || "";
    return `<button type="button" class="sug-item" data-lat="${it.lat}" data-lng="${it.lon}" data-full="${full.replace(/"/g,'&quot;')}">${titulo}</button>`;
  }).join("");
  box.querySelectorAll(".sug-item").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const lat = parseFloat(btn.getAttribute("data-lat"));
      const lng = parseFloat(btn.getAttribute("data-lng"));
      const full = btn.getAttribute("data-full");
      if(isFinite(lat)) elementos.campoLat.value = lat;
      if(isFinite(lng)) elementos.campoLng.value = lng;
      const estado = document.getElementById("estadoGeocodificar");
      if(estado) estado.textContent = "Coordenadas sugeridas asignadas.";
      box.innerHTML=""; box.style.display="none";
    });
  });
}

// Debounce para no saturar el servicio durante la escritura
const debSugerencias = debounce(async () => {
  try{
    const q = construirConsultaDireccion();
    if(!q){ mostrarSugerencias([]); return; }
    const res = await buscarSugerenciasDireccion(q);
    mostrarSugerencias(res);
  }catch(e){ mostrarSugerencias([]); }
}, 350);

function construirConsultaDireccion() {
  const partes = [];
  const direccion = elementos.campoDireccion.value.trim();
  const zona = elementos.campoZona.value.trim();
  const ciudad = elementos.campoCiudad.value.trim();
  const pais = elementos.campoPais.value.trim();
  if (direccion) partes.push(direccion);
  if (zona) partes.push(zona);
  if (ciudad) partes.push(ciudad);
  if (pais) partes.push(pais);
  return partes.join(", ");
}

// Arreglo principal con todos los ítems cargados desde data.json
let datos = [];
// Identificador del ítem actualmente en edición (o null si es uno nuevo)
let idEditando = null;

// Cache de referencias a campos del formulario y botones
const elementos = {
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

/** Genera un ID único para nuevos ítems */
function generarId(){ return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
const normalizar = (t) => (t || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

function valoresMarcados(contenedor) {
  return Array.from(contenedor.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);
}
function ponerMarcados(contenedor, valores) {
  Array.from(contenedor.querySelectorAll("input[type=checkbox]")).forEach(c => c.checked = valores.includes(c.value));
}

/** Construye la UI del formulario: llena selects, arma checklists y conecta eventos */
function construirUi() {
  elementos.campoTipoCentro.innerHTML = `<option value="">— Seleccionar —</option>` + TIPOS_CENTRO.map(ct => `<option value="${ct}">${ct}</option>`).join("");
  elementos.grupoEspecialidades.innerHTML = ESPECIALIDADES.map(sp => `<label><input type="checkbox" value="${sp}"/> <span class="cap">${sp}</span></label>`).join("");
  elementos.grupoPoblacion.innerHTML = POBLACIONES.map(p => `<label><input type="checkbox" value="${p}"/> <span class="cap">${p}</span></label>`).join("");

  elementos.campoEsCentro.addEventListener("change", () => {
    elementos.campoTipoCentro.disabled = !elementos.campoEsCentro.checked;
    if (!elementos.campoEsCentro.checked) elementos.campoTipoCentro.value = "";
  });

  elementos.btnNuevo.addEventListener("click", limpiarFormulario);
  elementos.btnEliminar.addEventListener("click", () => {
    if (!idEditando) { alert("No hay elemento seleccionado."); return; }
    const idx = datos.findIndex(d => d.id === idEditando);
    if (idx >= 0 && confirm("¿Eliminar este ítem?")) {
      datos.splice(idx, 1);
      guardarArchivo();
      limpiarFormulario();
      mostrarLista();
    }
  });

  elementos.formulario.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = recolectarDatos();
    const errores = validarDatos(item);
    if (errores.length) { mostrarErrores(errores); return; }
    if (idEditando) {
      const idx = datos.findIndex(d => d.id === idEditando);
      if (idx >= 0) datos[idx] = item;
    } else {
      item.id = generarId();
      datos.push(item);
    }
    guardarArchivo();
    limpiarFormulario();
    mostrarLista();
    alert("Guardado.");
  });
}

/** Toma los valores del formulario y arma el objeto de ítem */
function recolectarDatos() {
  const item = {
    id: idEditando || generarId(),
    nombre: elementos.campoNombre.value.trim(),
    esCentro: !!elementos.campoEsCentro.checked,
    tipoCentro: elementos.campoEsCentro.checked ? (elementos.campoTipoCentro.value || "") : undefined,
    especialidades: valoresMarcados(elementos.grupoEspecialidades),
    poblacion: valoresMarcados(elementos.grupoPoblacion),
    zona: elementos.campoZona.value.trim() || undefined,
    coords: (isFinite(parseFloat(elementos.campoLat.value)) && isFinite(parseFloat(elementos.campoLng.value))) ? { lat: parseFloat(elementos.campoLat.value), lng: parseFloat(elementos.campoLng.value) } : undefined,
    direccion: elementos.campoDireccion.value.trim() || undefined,
    ciudad: elementos.campoCiudad.value.trim() || undefined,
    pais: elementos.campoPais.value.trim() || undefined,
    web: elementos.campoWeb.value.trim() || undefined,
    contacto: elementos.campoContacto.value.trim() || undefined,
  };
  return item;
}

/** Valida campos obligatorios y rangos permitidos */
function validarDatos(i) {
  const errs = [];
  if (!i.nombre) errs.push("El nombre es obligatorio.");
  if (!i.coords) errs.push("Debés indicar lat y lng.");
  if (!i.especialidades || i.especialidades.length === 0) errs.push("Seleccioná al menos una especialidad.");
  if (!i.poblacion || i.poblacion.length === 0) errs.push("Seleccioná al menos una población.");
  if (i.esCentro && !i.tipoCentro) errs.push("Si es un centro, elementos tipo de centro es obligatorio.");
  if (i.coords) {
    const { lat, lng } = i.coords;
    if (lat < -90 || lat > 90) errs.push("Lat debe estar entre -90 y 90.");
    if (lng < -180 || lng > 180) errs.push("Lng debe estar entre -180 y 180.");
  }
  return errs;
}

/** Muestra una lista de errores de validación debajo del formulario */
function mostrarErrores(msgs) {
  if (!msgs.length) { elementos.errores.hidden = true; elementos.errores.innerHTML = ""; return; }
  elementos.errores.hidden = false;
  elementos.errores.innerHTML = "<ul>" + msgs.map(m => `<li>${m}</li>`).join("") + "</ul>";
}

/** Limpia el formulario y deja listo para crear un nuevo ítem */
function limpiarFormulario() {
  idEditando = null;
  elementos.campoId.value = "";
  elementos.campoNombre.value = "";
  elementos.campoEsCentro.checked = false;
  elementos.campoTipoCentro.value = "";
  elementos.campoTipoCentro.disabled = true;
  ponerMarcados(elementos.grupoEspecialidades, []);
  ponerMarcados(elementos.grupoPoblacion, []);
  elementos.campoZona.value = "";
  elementos.campoLat.value = "";
  elementos.campoLng.value = "";
  elementos.campoDireccion.value = "";
  elementos.campoCiudad.value = "";
  elementos.campoPais.value = "";
  elementos.campoWeb.value = "";
  elementos.campoContacto.value = "";
  mostrarErrores([]);
}

/** Carga data.json para listar ítems o usa fallback si no está disponible */
function cargarDatos() {
  return fetch("data.json", { cache: "no-store" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
    .then(arr => { datos = Array.isArray(arr) ? arr : []; })
    .catch(() => { datos = window.__FALLBACK__ || []; });
}

/** Pinta el listado lateral con los ítems disponibles y botones de edición */
function mostrarLista() {
  elementos.conteo.textContent = datos.length;
  elementos.lista.innerHTML = datos.map(d => {
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

  elementos.lista.querySelectorAll("[data-editar]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-editar");
      const it = datos.find(x => x.id === id);
      if (it) cargarFormulario(it);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

/** Carga en el formulario los datos del ítem seleccionado para editar */
function cargarFormulario(it) {
  idEditando = it.id;
  elementos.campoId.value = it.id;
  elementos.campoNombre.value = it.nombre || "";
  elementos.campoEsCentro.checked = !!it.esCentro;
  elementos.campoTipoCentro.disabled = !it.esCentro;
  elementos.campoTipoCentro.value = it.tipoCentro || "";
  ponerMarcados(elementos.grupoEspecialidades, it.especialidades || []);
  ponerMarcados(elementos.grupoPoblacion, it.poblacion || []);
  elementos.campoZona.value = it.zona || "";
  elementos.campoLat.value = it.coords?.lat ?? "";
  elementos.campoLng.value = it.coords?.lng ?? "";
  elementos.campoDireccion.value = it.direccion || "";
  elementos.campoCiudad.value = it.ciudad || "";
  elementos.campoPais.value = it.pais || "";
  elementos.campoWeb.value = it.web || "";
  elementos.campoContacto.value = it.contacto || "";
  mostrarErrores([]);
}

/** Descarga un data.json actualizado con los cambios realizados */
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
  ["campoDireccion","campoZona","campoCiudad","campoPais"].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener("input", debSugerencias); }});
  const btnGeo = document.getElementById('btnGeocodificar');
  const estadoGeo = document.getElementById('estadoGeocodificar');
  if (btnGeo) {
    btnGeo.addEventListener('click', async () => {
      try {
        estadoGeo.textContent = 'Buscando...'; btnGeo.disabled = true;
        const q = construirConsultaDireccion();
        if (!q) { estadoGeo.textContent = 'Completá dirección / ciudad / país.'; btnGeo.disabled = false; return; }
        const p = await geocodificarDireccion(q);
        elementos.campoLat.value = isFinite(p.lat) ? p.lat : '';
        elementos.campoLng.value = isFinite(p.lng) ? p.lng : '';
        estadoGeo.textContent = 'Coordenadas encontradas.';
      } catch (e) {
        estadoGeo.textContent = 'No se pudo geocodificar: ' + e.message;
      } finally {
        btnGeo.disabled = false;
      }
    });
  }

  window.__FALLBACK__ = [{"id": "1", "nombre": "Centro Andares", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["psicopedagogo", "terapia ocupacional", "psicologo TCC"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.6037, "lng": -58.3816}, "direccion": "Av. Corrientes 1000", "ciudad": "CABA", "pais": "Argentina", "zona": "Flores, CABA, Argentina", "web": "https://ejemplo.org/andares", "contacto": "+54 11 5555-1111"}, {"id": "2", "nombre": "Clínica Norte", "esCentro": true, "tipoCentro": "centro clinica de profecionales", "especialidades": ["psiquiatra", "psicologo psicoanalista"], "poblacion": ["adultos", "infanto-juvenil"], "coords": {"lat": 4.711, "lng": -74.0721}, "direccion": "Cra 7 # 12-34", "ciudad": "Bogotá", "pais": "Colombia", "zona": "Bogotá, Colombia"}, {"id": "3", "nombre": "Dra. María López", "esCentro": false, "especialidades": ["pediatra", "pediatra de neurodesarrollo"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -33.4489, "lng": -70.6693}, "ciudad": "Santiago", "pais": "Chile", "zona": "Santiago, Chile", "contacto": "+56 2 2222-3333"}, {"id": "4", "nombre": "NeuroCentro Madrid", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["neurologo", "psiquiatra"], "poblacion": ["adultos"], "coords": {"lat": 40.4168, "lng": -3.7038}, "ciudad": "Madrid", "pais": "España", "zona": "Madrid, España", "web": "https://ejemplo.org/neurocentro"}, {"id": "5", "nombre": "Apoyo Escolar Retiro", "esCentro": false, "especialidades": ["apoyo escolar", "coaching"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.5918, "lng": -58.3817}, "ciudad": "CABA", "pais": "Argentina", "zona": "Retiro, CABA, Argentina"}, {"id": "6", "nombre": "Therapy Hub NYC", "esCentro": true, "tipoCentro": "centro de terapias", "especialidades": ["psicologo TCC", "terapia ocupacional"], "poblacion": ["adultos", "infanto-juvenil"], "coords": {"lat": 40.7128, "lng": -74.006}, "ciudad": "Washington DC", "pais": "EEUU", "zona": "Washington DC, EEUU"}, {"id": "7", "nombre": "Dr. João Pereira", "esCentro": false, "especialidades": ["neurologo"], "poblacion": ["adultos"], "coords": {"lat": -23.5505, "lng": -46.6333}, "ciudad": "São Paulo", "pais": "Brasil", "zona": "São Paulo, Brasil"}, {"id": "8", "nombre": "Centro Horizonte Lima", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["psicopedagogo", "psicologo psicoanalista"], "poblacion": ["infanto-juvenil", "adultos"], "coords": {"lat": -12.0464, "lng": -77.0428}, "ciudad": "Lima", "pais": "Perú", "zona": "Lima, Perú"}, {"id": "9", "nombre": "Dra. Ana Gómez", "esCentro": false, "especialidades": ["psicologo psicoanalista"], "poblacion": ["adultos"], "coords": {"lat": 41.3851, "lng": 2.1734}, "ciudad": "Barcelona", "pais": "España", "zona": "Barcelona, España"}, {"id": "10", "nombre": "Centro Infantil Montevideo", "esCentro": true, "tipoCentro": "centro de terapias", "especialidades": ["terapia ocupacional", "psicopedagogo"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.9011, "lng": -56.1645}, "ciudad": "Montevideo", "pais": "Uruguay", "zona": "Montevideo, Uruguay"}];
  construirUi();
  await cargarDatos();
  mostrarLista();
});
