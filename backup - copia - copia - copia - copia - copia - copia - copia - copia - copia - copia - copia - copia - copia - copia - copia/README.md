# Mapa de Red de Profesionales

Mapa ligero basado en **Leaflet** para visualizar y filtrar profesionales/centros. Esta versión incluye mejoras de **calidad de datos**, **UX**, y **organización**.

## Novedades principales
- **Base de datos en JavaScript**: `data.js` exporta `PROFESIONALES` + catálogos.
- **Esquema extendido** (modalidad, cobertura, idiomas, verificado, fechaActualizacion, fuente, notas).
- **UX**: debounce en búsqueda, orden estable (nombre/ciudad/distancia), `fitBounds` automático a resultados, botón “Limpiar todo”, botón “Copiar coords”, contador con `aria-live`.
- **Accesibilidad**: `aria-live` para cambios de resultados, estructura preparada para `label/fieldset` en filtros.
- **Seguridad**: sanitización en popups/lista (`esc()`).
- **Organización**: este README y licencia MIT.

## Estructura mínima
```
.
├─ index.html
├─ data.js
├─ mapa.js
├─ css/
└─ vendor/ (leaflet, markercluster opcional)
```

## Uso
1. Incluí **data.js** antes de **mapa.js** en `index.html`:
   ```html
   <script src="data.js" type="module"></script>
   <script src="mapa.js"></script>
   ```
2. Asegurate de tener un contenedor para el mapa y filtros (ids asumidos):
   ```html
   <input id="busqueda" placeholder="Buscar…" />
   <select id="ordenar-por">
     <option value="nombre">Nombre</option>
     <option value="ciudad">Ciudad</option>
     <option value="distancia">Distancia al centro del mapa</option>
   </select>
   <select id="filtro-especialidades"></select>
   <select id="filtro-poblacion"></select>
   <select id="filtro-modalidad"></select>
   <select id="filtro-tipo-centro"></select>
   <select id="filtro-zona"></select>
   <button id="btn-limpiar">Limpiar todo</button>

   <div id="total-resultados" class="sr-only"></div>
   <ul id="lista-resultados"></ul>
   <div id="map"></div>
   ```
3. Cargá Leaflet (y MarkerCluster si lo usás) en el HTML.

## Esquema de datos
Ver comentarios en `data.js`. Campos clave:
- `id`, `nombre`, `esCentro`, `tipoCentro`
- `especialidades`, `poblacion`, `modalidad`
- `cobertura`, `idiomas`, `coords {lat,lng}`
- `direccion`, `ciudad`, `provincia`, `pais`, `zona`
- `web`, `contacto`, `verificado`, `fechaActualizacion`, `fuente`, `notas`

> **Sugerencia:** mantener catálogos controlados (`TIPOS_CENTRO`, `ESPECIALIDADES`, etc.) para evitar duplicados por ortografía.

## Exportación/Importación
- **Fuente única**: se recomienda mantener `data.js` como fuente de verdad y editarlo con control de cambios.
- Si necesitás exportar a JSON para compartir, podés serializar `PROFESIONALES`:
  ```js
  const blob = new Blob([JSON.stringify(PROFESIONALES, null, 2)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "profesionales.json";
  a.click();
  ```

## Accesibilidad
- Anuncio de cantidad de resultados mediante `aria-live`.
- Agregar `label` asociado a cada control de filtro y `fieldset/legend` si agrupás.

## Desarrollo local
- Al ser estático, basta con abrir `index.html` o servir con un servidor simple:
  ```bash
  npx serve .
  ```

## Publicación
- **GitHub Pages / Netlify / Vercel**: subir el repo y publicar raíz como sitio estático.

## Contribuir
- Crear PR con cambios en `data.js` verificando:
  - No romper el esquema.
  - Tildes correctas, minúsculas en catálogos.
  - Coordenadas válidas.
- Probar manualmente: filtros, búsqueda, limpiar, popups, copiar coords, móvil.

## Licencia
MIT — ver `LICENSE`.
