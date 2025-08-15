
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


async function geocodificarDireccion(texto) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(texto);
  const resp = await fetch(url, {
    headers: { "Accept": "application/json" }
  });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const arr = await resp.json();
  if (!Array.isArray(arr) || arr.length === 0) throw new Error("Sin resultados");
  const punto = arr[0];
  return { lat: parseFloat(punto.lat), lng: parseFloat(punto.lon) };
}

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

let datos = [];
let idEditando = null;

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

function generarId(){ return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
const normalizar = (t) => (t || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

function valoresMarcados(contenedor) {
  return Array.from(contenedor.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);
}
function ponerMarcados(contenedor, valores) {
  Array.from(contenedor.querySelectorAll("input[type=checkbox]")).forEach(c => c.checked = valores.includes(c.value));
}

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

function mostrarErrores(msgs) {
  if (!msgs.length) { elementos.errores.hidden = true; elementos.errores.innerHTML = ""; return; }
  elementos.errores.hidden = false;
  elementos.errores.innerHTML = "<ul>" + msgs.map(m => `<li>${m}</li>`).join("") + "</ul>";
}

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

function cargarDatos() {
  return fetch("data.json", { cache: "no-store" })
    .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
    .then(arr => { datos = Array.isArray(arr) ? arr : []; })
    .catch(() => { datos = window.__FALLBACK__ || []; });
}

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
