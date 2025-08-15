
// --- Domain constants ---
const CENTER_TYPES = [
  "centro de integracion",
  "centro clinica de profecionales",
  "centro de terapias",
];

const SPECIALTIES = [
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

const POPULATIONS = ["infanto-juvenil", "adultos"];

// --- Color mapping for categories ---
// By default, color based on tipoCentro; if not a center, use 'profesional' color.
const CATEGORY_COLORS = {
  "centro de integracion": "#2563EB", // blue
  "centro clinica de profecionales": "#7C3AED", // violet
  "centro de terapias": "#F59E0B", // amber
  "profesional": "#059669", // green
};

// --- State ---
let items = [];       // full dataset
let filtered = [];    // filtered results
let editingId = null; // currently editing
let map, clusterLayer;
let clickMarker;

const els = {
  q: document.getElementById("q"),
  filtersCentros: document.getElementById("filters-centros"),
  filtersEspecialidades: document.getElementById("filters-especialidades"),
  filtersPoblacion: document.getElementById("filters-poblacion"),
  activeFilters: document.getElementById("activeFilters"),
  clearFilters: document.getElementById("btnClearFilters"),
  list: document.getElementById("list"),
  listCount: document.getElementById("listCount"),
  form: document.getElementById("itemForm"),
  formErrors: document.getElementById("formErrors"),
  id: document.getElementById("id"),
  nombre: document.getElementById("nombre"),
  esCentro: document.getElementById("esCentro"),
  tipoCentro: document.getElementById("tipoCentro"),
  especialidadesGroup: document.getElementById("especialidadesGroup"),
  poblacionGroup: document.getElementById("poblacionGroup"),
  lat: document.getElementById("lat"),
  lng: document.getElementById("lng"),
  direccion: document.getElementById("direccion"),
  ciudad: document.getElementById("ciudad"),
  pais: document.getElementById("pais"),
  web: document.getElementById("web"),
  contacto: document.getElementById("contacto"),
  btnNew: document.getElementById("btnNew"),
  btnDelete: document.getElementById("btnDelete"),
  btnExportJSON: document.getElementById("btnExportJSON"),
  btnExportCSV: document.getElementById("btnExportCSV"),
  fileImportJSON: document.getElementById("fileImportJSON"),
  legend: document.getElementById("legend"),
  dbStatus: document.getElementById("dbStatus"),
};

// --- Utilities ---
const normalize = (t) =>
  (t || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

function uid() {
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function pickChecked(container) {
  return Array.from(container.querySelectorAll("input[type=checkbox]:checked")).map(
    (c) => c.value
  );
}

function setChecked(container, values) {
  Array.from(container.querySelectorAll("input[type=checkbox]")).forEach((c) => {
    c.checked = values.includes(c.value);
  });
}

function downloadFile(filename, content, mime = "application/octet-stream") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCSV(data) {
  const headers = [
    "id","nombre","esCentro","tipoCentro",
    "especialidades","poblacion","lat","lng",
    "direccion","ciudad","pais","web","contacto"
  ];
  const rows = data.map((i) => ({
    id: i.id ?? "",
    nombre: i.nombre ?? "",
    esCentro: i.esCentro ? "TRUE" : "FALSE",
    tipoCentro: i.tipoCentro ?? "",
    especialidades: (i.especialidades || []).join("; "),
    poblacion: (i.poblacion || []).join("; "),
    lat: i.coords?.lat ?? "",
    lng: i.coords?.lng ?? "",
    direccion: i.direccion ?? "",
    ciudad: i.ciudad ?? "",
    pais: i.pais ?? "",
    web: i.web ?? "",
    contacto: i.contacto ?? "",
  }));
  const lines = [headers.join(",")].concat(
    rows.map((r) =>
      headers
        .map((h) => {
          const v = (r[h] ?? "").toString().replace(/"/g, '""');
          const needsQuotes = v.includes(",") || v.includes("\n") || v.includes('"') || v.includes(";");
          return needsQuotes ? `"${v}"` : v;
        })
        .join(",")
    )
  );
  return lines.join("\n");
}

function showErrors(msgs) {
  if (!msgs.length) {
    els.formErrors.hidden = true;
    els.formErrors.innerHTML = "";
    return;
  }
  els.formErrors.hidden = false;
  els.formErrors.innerHTML = "<ul>" + msgs.map((m) => `<li>${m}</li>`).join("") + "</ul>";
}

// --- Map ---
function colorFor(item) {
  if (item.esCentro) {
    return CATEGORY_COLORS[item.tipoCentro] || "#334155";
  }
  return CATEGORY_COLORS["profesional"];
}

function iconFor(item) {
  const color = colorFor(item);
  const emoji = item.esCentro ? "🏥" : "👤";
  const html = `
    <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:999px;background:${color};color:white;font-size:16px;border:2px solid white;box-shadow:0 6px 10px rgba(0,0,0,.25)">${emoji}</div>
  `;
  return L.divIcon({ html, className: "", iconAnchor: [16, 32], popupAnchor: [0, -16] });
}

function initMap() {
  map = L.map("map", { worldCopyJump: true }).setView([0, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  clusterLayer = L.markerClusterGroup();
  map.addLayer(clusterLayer);

  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    els.lat.value = lat.toFixed(6);
    els.lng.value = lng.toFixed(6);
    if (!clickMarker) {
      clickMarker = L.marker([lat, lng], { icon: L.divIcon({ className: "click-marker", html: '<div style="width:12px;height:12px;border:2px solid white;border-radius:50%;background:#0ea5e9;box-shadow:0 0 0 4px rgba(14,165,233,.3)"></div>' }) }).addTo(map);
    } else {
      clickMarker.setLatLng([lat, lng]);
    }
  });
}

function fitBoundsToData(rows) {
  const pts = rows.filter((i) => i.coords && isFinite(i.coords.lat) && isFinite(i.coords.lng));
  if (!pts.length) return;
  const bounds = L.latLngBounds(pts.map((i) => [i.coords.lat, i.coords.lng]));
  try { map.fitBounds(bounds.pad(0.2)); } catch {}
}

function renderMarkers(rows) {
  clusterLayer.clearLayers();
  rows.forEach((item) => {
    if (!item.coords) return;
    const m = L.marker([item.coords.lat, item.coords.lng], { icon: iconFor(item) });
    const tags = [...(item.especialidades||[]), ...(item.poblacion||[])].map((t) => `<span class="chip">${t}</span>`).join(" ");
    const centro = item.esCentro ? "Centro" + (item.tipoCentro ? " · " + item.tipoCentro : "") : "Profesional";
    const addr = [item.direccion, item.ciudad, item.pais].filter(Boolean).join(" · ");
    const web = item.web ? `<div><a href="${item.web}" target="_blank" rel="noreferrer">Sitio web</a></div>` : "";
    const contact = item.contacto ? `<div>Contacto: ${item.contacto}</div>` : "";
    m.bindPopup(`
      <div class="popup">
        <div class="title">${item.nombre}</div>
        <div class="meta">${centro}</div>
        ${addr ? `<div class="meta">${addr}</div>` : ""}
        <div class="tags">${tags}</div>
        ${web}
        ${contact}
        <div style="margin-top:6px">
          <button class="btn secondary btn-small" data-edit="${item.id}">Editar</button>
        </div>
      </div>
    `);
    clusterLayer.addLayer(m);
  });
  setTimeout(() => {
    // delegate edit button clicks inside popups
    document.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-edit");
        const item = items.find((i) => i.id === id);
        if (item) loadForm(item);
      });
    });
  }, 0);
}

// --- Filters ---
const stateFilters = {
  q: "",
  centros: [],
  especialidades: [],
  poblacion: [],
};

function buildFiltersUI() {
  // Centros
  els.filtersCentros.innerHTML = CENTER_TYPES
    .map(
      (ct) => `
      <label><input type="checkbox" value="${ct}"/> <span class="cap">${ct}</span></label>
    `
    )
    .join("");
  els.filtersCentros.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", () => {
      stateFilters.centros = pickChecked(els.filtersCentros);
      refresh();
    });
  });

  // Especialidades
  els.filtersEspecialidades.innerHTML = SPECIALTIES.map(
    (sp) => `<label><input type="checkbox" value="${sp}"/> <span class="cap">${sp}</span></label>`
  ).join("");
  els.filtersEspecialidades.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", () => {
      stateFilters.especialidades = pickChecked(els.filtersEspecialidades);
      refresh();
    });
  });

  // Población
  els.filtersPoblacion.innerHTML = POPULATIONS.map(
    (p) => `<label><input type="checkbox" value="${p}"/> <span class="cap">${p}</span></label>`
  ).join("");
  els.filtersPoblacion.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", () => {
      stateFilters.poblacion = pickChecked(els.filtersPoblacion);
      refresh();
    });
  });

  // Search
  els.q.addEventListener("input", () => {
    stateFilters.q = els.q.value;
    refresh();
  });

  // Clear
  els.clearFilters.addEventListener("click", () => {
    stateFilters.q = "";
    els.q.value = "";
    stateFilters.centros = [];
    setChecked(els.filtersCentros, []);
    stateFilters.especialidades = [];
    setChecked(els.filtersEspecialidades, []);
    stateFilters.poblacion = [];
    setChecked(els.filtersPoblacion, []);
    refresh();
  });
}

function applyFilters() {
  const q = normalize(stateFilters.q);
  return items.filter((i) => {
    const byName = q ? normalize(i.nombre).includes(q) : true;
    const byCenter = stateFilters.centros.length
      ? i.esCentro && i.tipoCentro
        ? stateFilters.centros.includes(i.tipoCentro)
        : false
      : true;
    const bySpec = stateFilters.especialidades.length
      ? (i.especialidades || []).some((s) => stateFilters.especialidades.includes(s))
      : true;
    const byPop = stateFilters.poblacion.length
      ? (i.poblacion || []).some((p) => stateFilters.poblacion.includes(p))
      : true;
    return byName && byCenter && bySpec && byPop;
  });
}

function renderActiveFilters() {
  const chips = [];
  if (stateFilters.q) chips.push(`<span class="chip">Nombre: "${stateFilters.q}"</span>`);
  stateFilters.centros.forEach((c) => chips.push(`<span class="chip">${c}</span>`));
  stateFilters.especialidades.forEach((s) => chips.push(`<span class="chip">${s}</span>`));
  stateFilters.poblacion.forEach((p) => chips.push(`<span class="chip">${p}</span>`));
  els.activeFilters.innerHTML = chips.length ? chips.join(" ") : `<span class="muted">Sin filtros activos</span>`;
}

// --- List ---
function renderList(rows) {
  els.listCount.textContent = rows.length;
  els.list.innerHTML = rows
    .map((i) => {
      const tags = [...(i.especialidades||[]), ...(i.poblacion||[])].map((t) => `<span class="chip">${t}</span>`).join(" ");
      const centro = i.esCentro ? "Centro" + (i.tipoCentro ? " · " + i.tipoCentro : "") : "Profesional";
      const city = [i.ciudad, i.pais].filter(Boolean).join(", ");
      return `
        <div class="row">
          <div class="title">
            <span>${i.nombre}</span>
            <span class="badge" style="background:${colorFor(i)}20;border-color:${colorFor(i)}"> ${i.esCentro ? "Centro" : "Prof."} </span>
          </div>
          <div class="meta">${centro}${city ? " · " + city : ""}</div>
          <div class="tags">${tags}</div>
          <div>
            <button class="btn secondary btn-small" data-edit="${i.id}">Editar</button>
          </div>
        </div>
      `;
    })
    .join("");

  // wire edit buttons
  els.list.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-edit");
      const item = items.find((x) => x.id === id);
      if (item) loadForm(item);
    });
  });
}

// --- Form ---
function buildFormUI() {
  // tipoCentro options
  els.tipoCentro.innerHTML = `<option value="">— Seleccionar —</option>` + CENTER_TYPES.map((ct) => `<option value="${ct}">${ct}</option>`).join("");

  // especialidades checkboxes
  els.especialidadesGroup.innerHTML = SPECIALTIES.map(
    (sp) => `<label><input type="checkbox" value="${sp}"/> <span class="cap">${sp}</span></label>`
  ).join("");

  // poblacion checkboxes
  els.poblacionGroup.innerHTML = POPULATIONS.map(
    (p) => `<label><input type="checkbox" value="${p}"/> <span class="cap">${p}</span></label>`
  ).join("");

  els.esCentro.addEventListener("change", (e) => {
    const checked = els.esCentro.checked;
    els.tipoCentro.disabled = !checked;
    if (!checked) els.tipoCentro.value = "";
  });

  els.btnNew.addEventListener("click", (e) => {
    clearForm();
  });

  els.btnDelete.addEventListener("click", (e) => {
    if (!editingId) { alert("No hay un elemento seleccionado para eliminar."); return; }
    const idx = items.findIndex((i) => i.id === editingId);
    if (idx >= 0 && confirm("¿Eliminar este ítem?")) {
      items.splice(idx, 1);
      clearForm();
      refresh();
    }
  });

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    // gather
    const data = collectForm();
    const errs = validateItem(data);
    if (errs.length) { showErrors(errs); return; }

    if (editingId) {
      const idx = items.findIndex((i) => i.id === editingId);
      if (idx >= 0) items[idx] = data;
    } else {
      data.id = uid();
      items.push(data);
    }
    clearForm();
    refresh();
    alert("Guardado.");
  });
}

function collectForm() {
  const espec = pickChecked(els.especialidadesGroup);
  const pobl = pickChecked(els.poblacionGroup);
  const esCentro = !!els.esCentro.checked;
  const lat = parseFloat(els.lat.value);
  const lng = parseFloat(els.lng.value);
  const obj = {
    id: editingId || uid(),
    nombre: els.nombre.value.trim(),
    esCentro,
    tipoCentro: esCentro ? (els.tipoCentro.value || "") : undefined,
    especialidades: espec,
    poblacion: pobl,
    coords: (isFinite(lat) && isFinite(lng)) ? { lat, lng } : undefined,
    direccion: els.direccion.value.trim() || undefined,
    ciudad: els.ciudad.value.trim() || undefined,
    pais: els.pais.value.trim() || undefined,
    web: els.web.value.trim() || undefined,
    contacto: els.contacto.value.trim() || undefined,
  };
  return obj;
}

function validateItem(i) {
  const errs = [];
  if (!i.nombre) errs.push("El nombre es obligatorio.");
  if (!i.coords) errs.push("Debés indicar lat y lng (podés hacer clic en el mapa).");
  if (!i.especialidades || i.especialidades.length === 0) errs.push("Seleccioná al menos una especialidad.");
  if (!i.poblacion || i.poblacion.length === 0) errs.push("Seleccioná al menos una población.");
  if (i.esCentro && !i.tipoCentro) errs.push("Si es un centro, el tipo de centro es obligatorio.");
  // lat/lng bounds
  if (i.coords) {
    const { lat, lng } = i.coords;
    if (lat < -90 || lat > 90) errs.push("Lat debe estar entre -90 y 90.");
    if (lng < -180 || lng > 180) errs.push("Lng debe estar entre -180 y 180.");
  }
  return errs;
}

function clearForm() {
  editingId = null;
  els.id.value = "";
  els.nombre.value = "";
  els.esCentro.checked = false;
  els.tipoCentro.value = "";
  els.tipoCentro.disabled = true;
  setChecked(els.especialidadesGroup, []);
  setChecked(els.poblacionGroup, []);
  els.lat.value = "";
  els.lng.value = "";
  els.direccion.value = "";
  els.ciudad.value = "";
  els.pais.value = "";
  els.web.value = "";
  els.contacto.value = "";
  showErrors([]);
}

function loadForm(item) {
  editingId = item.id;
  els.id.value = item.id;
  els.nombre.value = item.nombre || "";
  els.esCentro.checked = !!item.esCentro;
  els.tipoCentro.disabled = !item.esCentro;
  els.tipoCentro.value = (item.tipoCentro || "");
  setChecked(els.especialidadesGroup, item.especialidades || []);
  setChecked(els.poblacionGroup, item.poblacion || []);
  els.lat.value = item.coords?.lat ?? "";
  els.lng.value = item.coords?.lng ?? "";
  els.direccion.value = item.direccion || "";
  els.ciudad.value = item.ciudad || "";
  els.pais.value = item.pais || "";
  els.web.value = item.web || "";
  els.contacto.value = item.contacto || "";
  showErrors([]);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- Export / Import ---
function wireExportImport() {
  els.btnExportJSON.addEventListener("click", () => {
    const content = JSON.stringify(items, null, 2);
    downloadFile("data.json", content, "application/json");
  });
  els.btnExportCSV.addEventListener("click", () => {
    downloadFile("profesionales.csv", toCSV(items), "text/csv");
  });
  els.fileImportJSON.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("El JSON debe ser un arreglo.");
      // sanitize minimal
      items = data.map((raw, idx) => ({
        id: String(raw.id ?? uid()),
        nombre: String(raw.nombre ?? "Sin nombre"),
        esCentro: !!raw.esCentro,
        tipoCentro: raw.tipoCentro || undefined,
        especialidades: Array.isArray(raw.especialidades) ? raw.especialidades : [],
        poblacion: Array.isArray(raw.poblacion) ? raw.poblacion : [],
        coords: raw.coords && typeof raw.coords.lat === "number" && typeof raw.coords.lng === "number"
          ? { lat: raw.coords.lat, lng: raw.coords.lng }
          : undefined,
        direccion: raw.direccion || undefined,
        ciudad: raw.ciudad || undefined,
        pais: raw.pais || undefined,
        web: raw.web || undefined,
        contacto: raw.contacto || undefined,
      }));
      refresh();
      alert("Importación realizada.");
    } catch (err) {
      alert("Error al importar: " + err.message);
    } finally {
      e.target.value = "";
    }
  });
}

// --- Legend ---
function renderLegend() {
  els.legend.innerHTML = `
    <div><strong>Leyenda</strong></div>
    <div class="item"><span class="swatch" style="background:${CATEGORY_COLORS["centro de integracion"]}"></span> Centro de integración</div>
    <div class="item"><span class="swatch" style="background:${CATEGORY_COLORS["centro clinica de profecionales"]}"></span> Centro clínica de profecionales</div>
    <div class="item"><span class="swatch" style="background:${CATEGORY_COLORS["centro de terapias"]}"></span> Centro de terapias</div>
    <div class="item"><span class="swatch" style="background:${CATEGORY_COLORS["profesional"]}"></span> Profesional individual</div>
  `;
}

// --- Data loading ---
async function loadData() {
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    items = await res.json();
    els.dbStatus.innerHTML = 'Base de datos: <strong>data.json</strong> ✔';
  } catch (err) {
    // Fallback embedded data
    items = window.__FALLBACK_DATA__ || [];
    els.dbStatus.innerHTML = 'Base de datos: fallback embebido (no se pudo leer <strong>data.json</strong>).';
  }
}

// --- Refresh everything ---
function refresh() {
  filtered = applyFilters();
  renderActiveFilters();
  renderList(filtered);
  renderMarkers(filtered);
  fitBoundsToData(filtered);
}

// --- Boot ---
window.addEventListener("DOMContentLoaded", async () => {
  // inject fallback data
  window.__FALLBACK_DATA__ = [{"id": "1", "nombre": "Centro Andares", "esCentro": true, "tipoCentro": "centro de terapias", "especialidades": ["psicopedagogo", "terapia ocupacional", "psicologo TCC"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.6037, "lng": -58.3816}, "direccion": "Av. Corrientes 1000, CABA", "ciudad": "Buenos Aires", "pais": "Argentina", "web": "https://ejemplo.org/andares", "contacto": "+54 11 5555-1111"}, {"id": "2", "nombre": "Clínica Norte", "esCentro": true, "tipoCentro": "centro clinica de profecionales", "especialidades": ["psiquiatra", "psicologo psicoanalista"], "poblacion": ["adultos", "infanto-juvenil"], "coords": {"lat": 4.711, "lng": -74.0721}, "direccion": "Cra 7 # 12-34", "ciudad": "Bogotá", "pais": "Colombia"}, {"id": "3", "nombre": "Dra. María López", "esCentro": false, "especialidades": ["pediatra", "pediatra de neurodesarrollo"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -33.4489, "lng": -70.6693}, "ciudad": "Santiago", "pais": "Chile", "contacto": "+56 2 2222-3333"}, {"id": "4", "nombre": "NeuroCentro Madrid", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["neurologo", "psiquiatra"], "poblacion": ["adultos"], "coords": {"lat": 40.4168, "lng": -3.7038}, "ciudad": "Madrid", "pais": "España", "web": "https://ejemplo.org/neurocentro"}, {"id": "5", "nombre": "Apoyo Escolar Retiro", "esCentro": false, "especialidades": ["apoyo escolar", "coaching"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.5918, "lng": -58.3817}, "ciudad": "Buenos Aires", "pais": "Argentina"}, {"id": "6", "nombre": "Therapy Hub NYC", "esCentro": true, "tipoCentro": "centro de terapias", "especialidades": ["psicologo TCC", "terapia ocupacional"], "poblacion": ["adultos", "infanto-juvenil"], "coords": {"lat": 40.7128, "lng": -74.006}, "ciudad": "New York", "pais": "USA"}, {"id": "7", "nombre": "Dr. João Pereira", "esCentro": false, "especialidades": ["neurologo"], "poblacion": ["adultos"], "coords": {"lat": -23.5505, "lng": -46.6333}, "ciudad": "São Paulo", "pais": "Brasil"}, {"id": "8", "nombre": "Centro Horizonte Lima", "esCentro": true, "tipoCentro": "centro de integracion", "especialidades": ["psicopedagogo", "psicologo psicoanalista"], "poblacion": ["infanto-juvenil", "adultos"], "coords": {"lat": -12.0464, "lng": -77.0428}, "ciudad": "Lima", "pais": "Perú"}, {"id": "9", "nombre": "Dra. Ana Gómez", "esCentro": false, "especialidades": ["psicologo psicoanalista"], "poblacion": ["adultos"], "coords": {"lat": 41.3851, "lng": 2.1734}, "ciudad": "Barcelona", "pais": "España"}, {"id": "10", "nombre": "Centro Infantil Montevideo", "esCentro": true, "tipoCentro": "centro de terapias", "especialidades": ["terapia ocupacional", "psicopedagogo"], "poblacion": ["infanto-juvenil"], "coords": {"lat": -34.9011, "lng": -56.1645}, "ciudad": "Montevideo", "pais": "Uruguay"}];
  initMap();
  buildFiltersUI();
  buildFormUI();
  renderLegend();
  wireExportImport();
  await loadData();
  refresh();
});
