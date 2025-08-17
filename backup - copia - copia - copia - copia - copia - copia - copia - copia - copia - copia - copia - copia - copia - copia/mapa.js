// mapa.js
// Requiere Leaflet (+ MarkerCluster si se desea) y data.js cargado previamente.
// Supone que existe un <div id="map"></div> y una barra de filtros básica.

/* global L, TIPOS_CENTRO, ESPECIALIDADES, POBLACIONES, MODALIDADES, PROFESIONALES */

(function () {
  // ---------- Utilidades ----------
  function esc(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function debounce(fn, ms = 250) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function normalizaCatalogo(arr) {
    const set = new Set(arr.map(s => s.trim().toLowerCase()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function normalizaRegistro(it) {
    const copy = { ...it };
    copy.nombre = it.nombre?.trim() ?? "";
    copy.tipoCentro = it.tipoCentro?.trim().toLowerCase() ?? "";
    copy.especialidades = (it.especialidades ?? []).map(s => s.trim().toLowerCase());
    copy.poblacion = (it.poblacion ?? []).map(s => s.trim().toLowerCase());
    copy.modalidad = (it.modalidad ?? []).map(s => s.trim().toLowerCase());
    copy.zona = it.zona?.trim();
    copy.ciudad = it.ciudad?.trim();
    copy.provincia = it.provincia?.trim();
    copy.pais = it.pais?.trim();
    return copy;
  }

  // ---------- Estado ----------
  const estado = {
    busqueda: "",
    filtroEspecialidades: new Set(),
    filtroPoblaciones: new Set(),
    filtroModalidad: new Set(),
    filtroTipoCentro: new Set(),
    filtroZona: new Set(),
    ordenarPor: "nombre" // "nombre" | "ciudad" | "distancia"
  };

  // ---------- Mapa ----------
  const mapa = L.map("map", { zoomControl: true }).setView([-38.4161, -63.6167], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }).addTo(mapa);

  // Capa agrupada (opcional: usar MarkerCluster si está incluído)
  const agrupa = (L.markerClusterGroup ? L.markerClusterGroup() : L.layerGroup()).addTo(mapa);

  
  // ---------- Datos ----------
  let datos = PROFESIONALES.map(normalizaRegistro);

  function deriveFromData(arr) {
    const tipos = new Set();
    const espec = new Set();
    const pobl = new Set();
    const mod = new Set();
    arr.forEach(d => {
      if (d.tipoCentro) tipos.add(d.tipoCentro.trim().toLowerCase());
      (d.especialidades || []).forEach(x => x && espec.add(String(x).trim().toLowerCase()));
      (d.poblacion || []).forEach(x => x && pobl.add(String(x).trim().toLowerCase()));
      (d.modalidad || []).forEach(x => x && mod.add(String(x).trim().toLowerCase()));
    });
    return {
      tiposCentro: normalizaCatalogo(Array.from(tipos)),
      especialidades: normalizaCatalogo(Array.from(espec)),
      poblaciones: normalizaCatalogo(Array.from(pobl)),
      modalidades: normalizaCatalogo(Array.from(mod))
    };
  }

  const providedCatalog = {
    tiposCentro: (typeof TIPOS_CENTRO !== "undefined" && Array.isArray(TIPOS_CENTRO)) ? normalizaCatalogo(TIPOS_CENTRO) : [],
    especialidades: (typeof ESPECIALIDADES !== "undefined" && Array.isArray(ESPECIALIDADES)) ? normalizaCatalogo(ESPECIALIDADES) : [],
    poblaciones: (typeof POBLACIONES !== "undefined" && Array.isArray(POBLACIONES)) ? normalizaCatalogo(POBLACIONES) : [],
    modalidades: (typeof MODALIDADES !== "undefined" && Array.isArray(MODALIDADES)) ? normalizaCatalogo(MODALIDADES) : []
  };

  const derived = deriveFromData(datos);

  const catalogo = {
    tiposCentro: providedCatalog.tiposCentro.length ? providedCatalog.tiposCentro : derived.tiposCentro,
    especialidades: providedCatalog.especialidades.length ? providedCatalog.especialidades : derived.especialidades,
    poblaciones: providedCatalog.poblaciones.length ? providedCatalog.poblaciones : derived.poblaciones,
    modalidades: providedCatalog.modalidades.length ? providedCatalog.modalidades : derived.modalidades
  };


  // ---------- UI (asume ciertos ids en el HTML) ----------
  const UI = {
    busqueda: document.querySelector("#busqueda"),
    lista: document.querySelector("#lista-resultados"),
    total: document.querySelector("#total-resultados"),
    limpiar: document.querySelector("#btn-limpiar"),
    ordenar: document.querySelector("#ordenar-por"),
    filtros: {
      especialidades: document.querySelector("#filtro-especialidades"),
      poblacion: document.querySelector("#filtro-poblacion"),
      modalidad: document.querySelector("#filtro-modalidad"),
      tipoCentro: document.querySelector("#filtro-tipo-centro"),
      zona: document.querySelector("#filtro-zona")
    }
  };

  // Accesibilidad para anunciar conteos
  if (UI.total) {
    UI.total.setAttribute("aria-live", "polite");
    UI.total.setAttribute("role", "status");
  }

  // Rellenar selects/checks si existen
  function poblarOpciones() {
    function setOptions(el, arr, withEmpty = true) {
      if (!el) return;
      el.innerHTML = ""; // seguro, controlado por nosotros
      if (withEmpty) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "— Todas —";
        el.appendChild(opt);
      }
      arr.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        el.appendChild(opt);
      });
    }

    setOptions(UI.filtros.especialidades, catalogo.especialidades);
    setOptions(UI.filtros.poblacion, catalogo.poblaciones);
    setOptions(UI.filtros.modalidad, catalogo.modalidades);
    setOptions(UI.filtros.tipoCentro, catalogo.tiposCentro);
    // zonas a partir de los datos
    if (UI.filtros.zona) {
      const zonas = normalizaCatalogo(
        Array.from(new Set(datos.map(d => (d.zona ?? "").trim().toLowerCase()).filter(Boolean)))
      );
      setOptions(UI.filtros.zona, zonas);
    }
  }

  poblarOpciones();

  // ---------- Lógica de filtrado ----------
  function coincideTexto(haystack, needle) {
    if (!needle) return true;
    const h = haystack.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const n = needle.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    return h.includes(n);
  }

  function pasaFiltros(d) {
    const texto = [
      d.nombre, d.direccion, d.ciudad, d.provincia, d.pais, d.zona,
      ...(d.especialidades || []),
      ...(d.poblacion || [])
    ].filter(Boolean).join(" · ");
    if (!coincideTexto(texto, estado.busqueda)) return false;

    if (estado.filtroEspecialidades.size > 0) {
      const ok = d.especialidades?.some(e => estado.filtroEspecialidades.has(e)) ?? false;
      if (!ok) return false;
    }
    if (estado.filtroPoblaciones.size > 0) {
      const ok = d.poblacion?.some(p => estado.filtroPoblaciones.has(p)) ?? false;
      if (!ok) return false;
    }
    if (estado.filtroModalidad.size > 0) {
      const ok = d.modalidad?.some(m => estado.filtroModalidad.has(m)) ?? false;
      if (!ok) return false;
    }
    if (estado.filtroTipoCentro.size > 0 && d.tipoCentro) {
      if (!estado.filtroTipoCentro.has(d.tipoCentro)) return false;
    }
    if (estado.filtroZona.size > 0 && d.zona) {
      if (!estado.filtroZona.has(d.zona.toLowerCase())) return false;
    }
    return true;
  }

  function distanciaA(latlng) {
    if (!latlng) return Infinity;
    const c = mapa.getCenter();
    const dx = latlng.lat - c.lat;
    const dy = latlng.lng - c.lng;
    // aproximación para ordenar: no usamos haversine para rendimiento
    return dx * dx + dy * dy;
  }

  function ordenarResultados(arr) {
    const key = estado.ordenarPor;
    const copia = arr.slice();
    if (key === "nombre") {
      copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (key === "ciudad") {
      copia.sort((a, b) => (a.ciudad || "").localeCompare(b.ciudad || ""));
    } else if (key === "distancia") {
      copia.sort((a, b) => distanciaA(a.coords) - distanciaA(b.coords));
    }
    return copia;
  }

  // ---------- Render ----------
  let marcadores = new Map(); // id -> marker

  function limpiarCapa() {
    if (agrupa.clearLayers) agrupa.clearLayers();
    marcadores.clear();
  }

  function crearPopup(d) {
    const etiquetas = [
      ...(d.especialidades || []),
      ...(d.poblacion || []),
      ...(d.modalidad || []),
    ].map(t => `<span class="tag">${esc(t)}</span>`).join(" ");

    const copiar = `<button class="btn-copiar-coords" data-id="${esc(d.id)}">Copiar coords</button>`;

    return `
      <div class="popup">
        <div class="titulo">${esc(d.nombre)}</div>
        <div class="meta">${esc(d.esCentro ? (d.tipoCentro || "centro") : (d.tipoCentro || "profesional"))}${d.zona ? " · " + esc(d.zona) : ""}</div>
        ${d.direccion ? `<div class="meta">${esc(d.direccion)}</div>` : ""}
        <div class="tags">${etiquetas}</div>
        ${copiar}
      </div>
    `;
  }

  function renderLista(arr) {
    if (!UI.lista) return;
    UI.lista.innerHTML = "";
    arr.forEach(d => {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML = `
        <div class="i-titulo">${esc(d.nombre)}</div>
        <div class="i-meta">${esc(d.ciudad || "")}${d.zona ? " · " + esc(d.zona) : ""}</div>
      `;
      li.addEventListener("click", () => {
        const m = marcadores.get(d.id);
        if (m) {
          mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 14));
          m.openPopup();
        }
      });
      UI.lista.appendChild(li);
    });
  }

  function ajustarMapaAResultados(arr) {
    const pts = arr.filter(d => d.coords).map(d => [d.coords.lat, d.coords.lng]);
    if (pts.length) {
      const bounds = L.latLngBounds(pts);
      mapa.fitBounds(bounds, { padding: [32, 32] });
    }
  }

  function render() {
    const filtrados = ordenarResultados(datos.filter(pasaFiltros));

    // estado accesible
    if (UI.total) {
      UI.total.textContent = `${filtrados.length} resultado${filtrados.length === 1 ? "" : "s"}`;
    }

    // mapa
    limpiarCapa();
    filtrados.forEach(d => {
      if (!d.coords) return;
      const m = L.marker([d.coords.lat, d.coords.lng]);
      m.bindPopup(crearPopup(d));
      agrupa.addLayer(m);
      marcadores.set(d.id, m);
    });

    // lista
    renderLista(filtrados);

    // ajustar mapa a resultados
    ajustarMapaAResultados(filtrados);
  }

  // ---------- Eventos ----------
  if (UI.busqueda) {
    UI.busqueda.addEventListener("input", debounce(() => {
      estado.busqueda = UI.busqueda.value;
      render();
    }, 250));
  }

  if (UI.ordenar) {
    UI.ordenar.addEventListener("change", () => {
      estado.ordenarPor = UI.ordenar.value;
      render();
    });
  }

  function bindSelect(el, setRef) {
    if (!el) return;
    el.addEventListener("change", () => {
      setRef.clear();
      const v = (el.value || "").trim().toLowerCase();
      if (v) setRef.add(v);
      render();
    });
  }

  bindSelect(UI.filtros.especialidades, estado.filtroEspecialidades);
  bindSelect(UI.filtros.poblacion, estado.filtroPoblaciones);
  bindSelect(UI.filtros.modalidad, estado.filtroModalidad);
  bindSelect(UI.filtros.tipoCentro, estado.filtroTipoCentro);
  bindSelect(UI.filtros.zona, estado.filtroZona);

  if (UI.limpiar) {
    UI.limpiar.addEventListener("click", () => {
      estado.busqueda = "";
      estado.filtroEspecialidades.clear();
      estado.filtroPoblaciones.clear();
      estado.filtroModalidad.clear();
      estado.filtroTipoCentro.clear();
      estado.filtroZona.clear();
      estado.ordenarPor = "nombre";
      if (UI.busqueda) UI.busqueda.value = "";
      if (UI.ordenar) UI.ordenar.value = "nombre";
      ["especialidades", "poblacion", "modalidad", "tipo-centro", "zona"].forEach(id => {
        const el = document.querySelector(`#filtro-${id}`);
        if (el) el.value = "";
      });
      // Reset vista a Argentina/CABA por defecto
      mapa.setView([-38.4161, -63.6167], 4);
      render();
    });
  }

  // Click en "Copiar coords" dentro del popup
  mapa.on("popupopen", (e) => {
    const btn = e.popup.getElement().querySelector(".btn-copiar-coords");
    if (btn) {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const d = datos.find(x => x.id === id);
        if (d?.coords) {
          const txt = `${d.coords.lat}, ${d.coords.lng}`;
          navigator.clipboard.writeText(txt).then(() => {
            btn.textContent = "¡Copiado!";
            setTimeout(() => (btn.textContent = "Copiar coords"), 1500);
          });
        }
      });
    }
  });

  // ---------- Inicial ----------
  render();
})();
