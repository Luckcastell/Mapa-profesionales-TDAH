
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

const geocacheV1 = (() => {
  try { return JSON.parse(localStorage.getItem("geocache_v1") || "{}"); }
  catch { return {}; }
})();

function guardarGeocache(){ try{ localStorage.setItem("geocache_v1", JSON.stringify(geocacheV1)); }catch{} }

async function geocodificarDireccionMapa(texto) {
  const clave = texto.toLowerCase();
  if (geocacheV1[clave]) return geocacheV1[clave];
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(texto);
  const resp = await fetch(url, { headers: { "Accept": "application/json" }});
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const arr = await resp.json();
  if (!Array.isArray(arr) || arr.length === 0) throw new Error("sin resultados");
  const res = { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  geocacheV1[clave] = res; guardarGeocache();
  return res;
}

function construirConsultaParaItem(it) {
  const partes = [];
  if (it.direccion) partes.push(it.direccion);
  if (it.zona) partes.push(it.zona);
  if (it.ciudad) partes.push(it.ciudad);
  if (it.pais) partes.push(it.pais);
  return partes.join(", ");
}

async function geocodificarFaltantesYRefrescar() {
  let cambios = 0;
  for (const it of datos) {
    if ((!it.coords || !isFinite(it.coords.lat) || !isFinite(it.coords.lng))) {
      const q = construirConsultaParaItem(it);
      if (!q) continue;
      try {
        const p = await geocodificarDireccionMapa(q);
        if (p && isFinite(p.lat) && isFinite(p.lng)) {
          it.coords = { lat: p.lat, lng: p.lng };
          cambios++;
        }
      } catch(e){ /* silencio */ }
      await new Promise(r => setTimeout(r, 1200)); // respetar servicio
    }
  }
  if (cambios > 0) {
    try { refrescarVista(); } catch(e){}
  }
}



const COLORES_CATEGORIA = {
  "centro de integracion": "#2563EB",
  "centro clinica de profecionales": "#7C3AED",
  "centro de terapias": "#F59E0B",
  "profesional": "#059669",
};

const COLORES_ESPECIALIDAD = {
  "psicologo psicoanalista": "#EF4444",
  "psicologo TCC": "#10B981",
  "psicopedagogo": "#3B82F6",
  "terapia ocupacional": "#F59E0B",
  "pediatra": "#8B5CF6",
  "pediatra de neurodesarrollo": "#EC4899",
  "psiquiatra": "#14B8A6",
  "neurologo": "#84CC16",
  "coaching": "#F97316",
  "apoyo escolar": "#06B6D4",
};

let datos = [];
let filtrados = [];
let mapa, capaDeGrupos;

const elementos = {
  busqueda: document.getElementById("busqueda"),
  filtroZona: document.getElementById("filtroZona"),
  filtrosCentros: document.getElementById("filtrosCentros"),
  filtrosEspecialidades: document.getElementById("filtrosEspecialidades"),
  filtrosPoblacion: document.getElementById("filtrosPoblacion"),
  filtrosActivos: document.getElementById("filtrosActivos"),
  btnLimpiarFiltros: document.getElementById("btnLimpiarFiltros"),
  lista: document.getElementById("lista"),
  conteoLista: document.getElementById("conteoLista"),
  btnExportarJSON: document.getElementById("btnExportarJSON"),
  archivoImportarJSON: document.getElementById("archivoImportarJSON"),
  estadoBD: document.getElementById("estadoBD"),
};

const normalizar = (t) => (t || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

function descargar(nombre, contenido, mime = "application/octet-stream") {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function valoresMarcados(contenedor) {
  return Array.from(contenedor.querySelectorAll("input[type=checkbox]:checked")).map((c) => c.value);
}
function ponerMarcados(contenedor, valores) {
  Array.from(contenedor.querySelectorAll("input[type=checkbox]")).forEach((c) => c.checked = valores.includes(c.value));
}

function colorDeCategoria(entrada) {
  if (entrada.esCentro) {
    return COLORES_CATEGORIA[entrada.tipoCentro] || "#334155";
  }
  if (entrada.especialidades && entrada.especialidades.length) {
    const e0 = entrada.especialidades[0];
    return COLORES_ESPECIALIDAD[e0] || COLORES_CATEGORIA["profesional"];
  }
  return COLORES_CATEGORIA["profesional"];
}

function iconoPara(entrada) {
  const color = colorDeCategoria(entrada);
  const emoji = entrada.esCentro ? "🏛️" : "👤";
  const html = `
    <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;background:${color};color:white;font-size:16px;border:2px solid white;box-shadow:0 6px 10px rgba(0,0,0,.25)">${emoji}</div>
  `;
  return L.divIcon({ html, className: "", iconAnchor: [16, 32], popupAnchor: [0, -16] });
}

function iniciarMapa() {
  mapa = L.map("mapa", { worldCopyJump: true }).setView([0,0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapa);
  capaDeGrupos = L.markerClusterGroup();
  mapa.addLayer(capaDeGrupos);
}

function encuadrarMapa(filas) {
  const pts = filas.filter((i) => i.coords && isFinite(i.coords.lat) && isFinite(i.coords.lng));
  if (!pts.length) return;
  const bounds = L.latLngBounds(pts.map((i) => [i.coords.lat, i.coords.lng]));
  try { mapa.fitBounds(bounds.pad(0.2)); } catch {}
}

function pintarMarcadores(filas) {
  capaDeGrupos.clearLayers();
  filas.forEach((it) => {
    if (!it.coords) return;
    const m = L.marker([it.coords.lat, it.coords.lng], { icon: iconoPara(it) });
    const etiquetas = [...(it.especialidades||[]), ...(it.poblacion||[])].map((t) => `<span class="chip" style="background:${COLORES_ESPECIALIDAD[t]||'#f1f5f9'}20;border-color:${COLORES_ESPECIALIDAD[t]||'#e2e8f0'}">${t}</span>`).join(" ");
    const tipo = it.esCentro ? "Centro" + (it.tipoCentro ? " · " + it.tipoCentro : "") : "Profesional";
    const dir = [it.direccion, it.ciudad, it.pais].filter(Boolean).join(" · ");
    m.bindPopup(`
      <div class="popup">
        <div class="titulo">${it.nombre}</div>
        <div class="meta">${tipo}${it.zona ? " · " + it.zona : ""}</div>
        ${dir ? `<div class="meta">${dir}</div>` : ""}
        <div class="tags">${etiquetas}</div>
      </div>
    `);
    capaDeGrupos.addLayer(m);
  });
}

const estadoDeFiltros = { busqueda:"", centros:[], especialidades:[], poblacion:[], zona:"" };

function construirUiFiltros() {
  elementos.filtrosCentros.innerHTML = TIPOS_CENTRO.map((ct) => `<label><input type="checkbox" value="${ct}"/> <span class="cap">${ct}</span></label>`).join("");
  elementos.filtrosCentros.querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
    estadoDeFiltros.centros = valoresMarcados(elementos.filtrosCentros); refrescarVista();
  }));

  elementos.filtrosEspecialidades.innerHTML = ESPECIALIDADES.map((sp) => `<label><input type="checkbox" value="${sp}"/> <span class="cap">${sp}</span></label>`).join("");
  elementos.filtrosEspecialidades.querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
    estadoDeFiltros.especialidades = valoresMarcados(elementos.filtrosEspecialidades); refrescarVista();
  }));

  elementos.filtrosPoblacion.innerHTML = POBLACIONES.map((p) => `<label><input type="checkbox" value="${p}"/> <span class="cap">${p}</span></label>`).join("");
  elementos.filtrosPoblacion.querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
    estadoDeFiltros.poblacion = valoresMarcados(elementos.filtrosPoblacion); refrescarVista();
  }));

  elementos.busqueda.addEventListener("input", () => { estadoDeFiltros.busqueda = elementos.busqueda.value; refrescarVista(); });
  elementos.filtroZona.addEventListener("change", () => { estadoDeFiltros.zona = elementos.filtroZona.value; refrescarVista(); });

  elementos.btnLimpiarFiltros.addEventListener("click", () => {
    estadoDeFiltros.busqueda = ""; elementos.busqueda.value = "";
    estadoDeFiltros.zona = ""; elementos.filtroZona.value = "";
    estadoDeFiltros.centros = []; ponerMarcados(elementos.filtrosCentros, []);
    estadoDeFiltros.especialidades = []; ponerMarcados(elementos.filtrosEspecialidades, []);
    estadoDeFiltros.poblacion = []; ponerMarcados(elementos.filtrosPoblacion, []);
    refrescarVista();
  });
}

function aplicarFiltros() {
  const q = normalizar(estadoDeFiltros.busqueda);
  return datos.filter((i) => {
    const porNombre = q ? normalizar(i.nombre).includes(q) : true;
    const porCentro = estadoDeFiltros.centros.length ? (i.esCentro && i.tipoCentro ? estadoDeFiltros.centros.includes(i.tipoCentro) : false) : true;
    const porEsp = estadoDeFiltros.especialidades.length ? (i.especialidades||[]).some((s) => estadoDeFiltros.especialidades.includes(s)) : true;
    const porPob = estadoDeFiltros.poblacion.length ? (i.poblacion||[]).some((p) => estadoDeFiltros.poblacion.includes(p)) : true;
    const porZona = estadoDeFiltros.zona ? (i.zona === estadoDeFiltros.zona) : true;
    return porNombre && porCentro && porEsp && porPob && porZona;
  });
}

function mostrarFiltrosActivos() {
  const chips = [];
  if (estadoDeFiltros.busqueda) chips.push(`<span class="chip">Nombre: "${estadoDeFiltros.busqueda}"</span>`);
  if (estadoDeFiltros.zona) chips.push(`<span class="chip">Zona: ${estadoDeFiltros.zona}</span>`);
  estadoDeFiltros.centros.forEach((c) => chips.push(`<span class="chip">${c}</span>`));
  estadoDeFiltros.especialidades.forEach((s) => chips.push(`<span class="chip">${s}</span>`));
  estadoDeFiltros.poblacion.forEach((p) => chips.push(`<span class="chip">${p}</span>`));
  elementos.filtrosActivos.innerHTML = chips.length ? chips.join(" ") : `<span class="muted">Sin filtros activos</span>`;
}

function mostrarLista(filas) {
  elementos.conteoLista.textContent = filas.length;
  elementos.lista.innerHTML = filas.map((i) => {
    const etiquetas = [...(i.especialidades||[]), ...(i.poblacion||[])].map((t) => `<span class="chip" style="background:${COLORES_ESPECIALIDAD[t]||'#f1f5f9'}20;border-color:${COLORES_ESPECIALIDAD[t]||'#e2e8f0'}">${t}</span>`).join(" ");
    const tipo = i.esCentro ? "Centro" + (i.tipoCentro ? " · " + i.tipoCentro : "") : "Profesional";
    const ciudad = [i.zona || [i.ciudad, i.pais].filter(Boolean).join(", ")].filter(Boolean).join("");
    return `
      <div class="fila">
        <div class="titulo">
          <span>${i.nombre}</span>
          <span class="etiqueta" style="background:${colorDeCategoria(i)}20;border-color:${colorDeCategoria(i)}">${i.esCentro ? "Centro" : "Prof."}</span>
        </div>
        <div class="meta">${tipo}${ciudad ? " · " + ciudad : ""}</div>
        <div class="tags">${etiquetas}</div>
      </div>
    `;
  }).join("");
}

function prepararExportarImportar() {
  elementos.btnExportarJSON.addEventListener("click", () => descargar("data.json", JSON.stringify(datos, null, 2), "application/json"));
  elementos.archivoImportarJSON.addEventListener("change", async (e) => {
    const archivo = e.target.files[0]; if (!archivo) return;
    try {
      const texto = await archivo.text();
      const arr = JSON.parse(texto);
      if (!Array.isArray(arr)) throw new Error("El JSON debe ser un arreglo.");
      datos = arr;
      completarOpcionesZona();
      refrescarVista();
      alert("Importación realizada.");
    } catch (err) {
      alert("Error al importar: " + err.message);
    } finally {
      e.target.value = "";
    }
  });
}

async function cargarDatos() {
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    datos = await res.json();
    elementos.estadoBD.innerHTML = 'Base de datos: <strong>data.json</strong> ✔';
  } catch {
    datos = window.__DATOS_POR_DEFECTO__ || [];
    elementos.estadoBD.innerHTML = 'Base de datos: <em>fallback embebido</em> (no se pudo leer <strong>data.json</strong>).';
  }
}

function completarOpcionesZona() {
  const zonas = Array.from(new Set(datos.map(d => d.zona).filter(Boolean))).sort();
  elementos.filtroZona.innerHTML = `<option value="">Todas</option>` + zonas.map(z => `<option value="${z}">${z}</option>`).join("");
}

function refrescarVista() {
  filtrados = aplicarFiltros();
  mostrarFiltrosActivos();
  mostrarLista(filtrados);
  pintarMarcadores(filtrados);
  encuadrarMapa(filtrados);
}

window.addEventListener("DOMContentLoaded", async () => {
  window.__DATOS_POR_DEFECTO__ = [{"id": "1", "nombre": "Centro Andares", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["psicopedagogo", "terapia ocupacional", "psicologo TCC"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.6037, "lng": -58.3816}, "direccion": "Av. Corrientes 1000", "ciudad": "CABA", "pais": "Argentina", "zona": "Flores, CABA, Argentina", "web": "https://ejemplo.org/andares", "contacto": "+54 11 5555-1111"}, {"id": "2", "nombre": "Clínica Norte", "esCentro": true, "tipoCentro": "centro clinica de profecionales", "especialidades": ["psiquiatra", "psicologo psicoanalista"], "poblacion": ["adultos", "infanto-juvenil"], "coords": {"lat": 4.711, "lng": -74.0721}, "direccion": "Cra 7 # 12-34", "ciudad": "Bogotá", "pais": "Colombia", "zona": "Bogotá, Colombia"}, {"id": "3", "nombre": "Dra. María López", "esCentro": false, "especialidades": ["pediatra", "pediatra de neurodesarrollo"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -33.4489, "lng": -70.6693}, "ciudad": "Santiago", "pais": "Chile", "zona": "Santiago, Chile", "contacto": "+56 2 2222-3333"}, {"id": "4", "nombre": "NeuroCentro Madrid", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["neurologo", "psiquiatra"], "poblacion": ["adultos"], "coords": {"lat": 40.4168, "lng": -3.7038}, "ciudad": "Madrid", "pais": "España", "zona": "Madrid, España", "web": "https://ejemplo.org/neurocentro"}, {"id": "5", "nombre": "Apoyo Escolar Retiro", "esCentro": false, "especialidades": ["apoyo escolar", "coaching"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.5918, "lng": -58.3817}, "ciudad": "CABA", "pais": "Argentina", "zona": "Retiro, CABA, Argentina"}, {"id": "6", "nombre": "Therapy Hub NYC", "esCentro": true, "tipoCentro": "centro de terapias", "especialidades": ["psicologo TCC", "terapia ocupacional"], "poblacion": ["adultos", "infanto-juvenil"], "coords": {"lat": 40.7128, "lng": -74.006}, "ciudad": "Washington DC", "pais": "EEUU", "zona": "Washington DC, EEUU"}, {"id": "7", "nombre": "Dr. João Pereira", "esCentro": false, "especialidades": ["neurologo"], "poblacion": ["adultos"], "coords": {"lat": -23.5505, "lng": -46.6333}, "ciudad": "São Paulo", "pais": "Brasil", "zona": "São Paulo, Brasil"}, {"id": "8", "nombre": "Centro Horizonte Lima", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["psicopedagogo", "psicologo psicoanalista"], "poblacion": ["infanto-juvenil", "adultos"], "coords": {"lat": -12.0464, "lng": -77.0428}, "ciudad": "Lima", "pais": "Perú", "zona": "Lima, Perú"}, {"id": "9", "nombre": "Dra. Ana Gómez", "esCentro": false, "especialidades": ["psicologo psicoanalista"], "poblacion": ["adultos"], "coords": {"lat": 41.3851, "lng": 2.1734}, "ciudad": "Barcelona", "pais": "España", "zona": "Barcelona, España"}, {"id": "10", "nombre": "Centro Infantil Montevideo", "esCentro": true, "tipoCentro": "centro de terapias", "especialidades": ["terapia ocupacional", "psicopedagogo"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.9011, "lng": -56.1645}, "ciudad": "Montevideo", "pais": "Uruguay", "zona": "Montevideo, Uruguay"}];
  iniciarMapa();
  construirUiFiltros();
  prepararExportarImportar();
  await cargarDatos();
  geocodificarFaltantesYRefrescar();
  completarOpcionesZona();
  refrescarVista();

  // Asegurar que elementos mapa recalcula tamaño al cambiar elementos layout/viewport
  setTimeout(() => { try { mapa.invalidateSize(); } catch(e){} }, 200);
  window.addEventListener("resize", () => { try { mapa.invalidateSize(); } catch(e){} });
});
