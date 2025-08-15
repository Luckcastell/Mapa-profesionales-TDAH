# Mapa de Profesionales - Proyecto Web

## Descripción General
Este proyecto es una aplicación web interactiva para visualizar y gestionar una red de profesionales en un mapa mundial. 
Incluye filtros avanzados, un sistema de geocodificación precisa para ubicar direcciones, y herramientas para administración de datos.

---
## Instrucciones para Usuarios

1. **Visualización del Mapa**:
   - El mapa muestra puntos de profesionales o centros según su ubicación exacta.
   - Cada marcador tiene un color que representa la especialidad.
   - Se puede hacer clic en cada marcador para ver detalles.

2. **Filtros**:
   - Filtrar por nombre del profesional o centro.
   - Filtrar por tipo de centro (Integración, Clínica de Profesionales, Terapias).
   - Filtrar por especialidad (Psicólogo, Pediatra, Neurólogo, etc.).
   - Filtrar por grupo etario (Infanto-juvenil o Adultos).
   - Filtrar por zona (ej.: Flores, CABA, España, EEUU).

3. **Listado y Filtros Laterales**:
   - Desde la barra lateral puedes alternar entre la vista de **Filtros** y la de **Listado de Resultados**.

4. **Precisión de Ubicaciones**:
   - El sistema utiliza geocodificación estructurada (calle, ciudad, país) y sesgo por zona para mejorar la precisión.
   - Si no encuentra coordenadas exactas, intenta aproximarlas.

---
## Instrucciones para Administradores

1. **Acceder al Formulario de Alta/Edición**:
   - En la interfaz de administrador, ingresar a `formulario.html`.
   - Completar datos del profesional/centro. Es recomendable incluir **calle y número**, además de ciudad y país.

2. **Búsqueda Automática de Coordenadas**:
   - Usar el botón **"Buscar coordenadas por dirección"** o el autocompletado mientras escribes.
   - El sistema devolverá coordenadas precisas y las colocará en los campos de Latitud/Longitud.

3. **Exportar Datos**:
   - Desde la interfaz de administrador, se puede exportar toda la base en formatos CSV o JSON.
   - Esto permite respaldos o migraciones.

4. **Importar Datos**:
   - Editar manualmente el archivo `data.json` con nuevos registros, cuidando el formato.

5. **Página de Geocodificación Rápida**:
   - Usar `geocodificar.html` para obtener coordenadas exactas en formato listo para pegar en `data.json`.

---
## Funcionamiento Interno

- **Frontend**: HTML, CSS y JavaScript.
- **Mapa**: Biblioteca LeafletJS para mapas interactivos.
- **Geocodificación**: API Nominatim (OpenStreetMap) con búsqueda estructurada y sesgo por zona.
- **Almacenamiento Local**: Cache en `localStorage` para evitar consultas repetidas.
- **Datos**: Archivo `data.json` con todos los ítems.

---
## Requisitos Técnicos

- Navegador moderno con JavaScript habilitado.
- Conexión a internet para cargar el mapa y la API de geocodificación.


> Nota: Esta versión incluye **comentarios detallados** en todo el código (HTML/CSS/JS) para facilitar mantenimiento y traspaso.
