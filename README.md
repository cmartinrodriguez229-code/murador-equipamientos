# MURADOR EQUIPAMIENTOS — catálogo online

Proyecto separado de DECANTS PARANÁ. Base inicial de 63 códigos extraídos del Catálogo General Murador, edición 2026.

## Importante antes de publicar
- El catálogo inicial contiene los códigos del PDF y campos editables; hay que revisar los nombres, categorías y marcas extraídos y completar las fotografías reales. No se incluyen imágenes inventadas como si fueran fotos oficiales.
- El logo institucional definitivo debe extraerse/recibirse como archivo original para conservarlo fielmente. La M del encabezado es un marcador temporal, no reemplaza el logo oficial.
- El número de WhatsApp configurado según el PDF es 3434 62-7755. Verificar el formato internacional antes de producción.
- Este proyecto usa un Worker derivado del backend de referencia, con sesión admin y KV. Crear un namespace KV exclusivo y sustituir el ID de ejemplo en `wrangler.jsonc`..

## Instalación
1. Crear un repositorio nuevo `murador-equipamientos` en GitHub y subir todos los archivos.
2. Instalar Node.js LTS.
3. Ejecutar `npm install`.
4. Crear un KV exclusivo: `npx wrangler kv namespace create MURADOR` y copiar su ID en `wrangler.jsonc`. El binding se llama `MURADOR` y debe apuntar al namespace nuevo de Murador, nunca al de Decants.
5. Configurar secretos del Worker: `npx wrangler secret put ADMIN_USER`, `npx wrangler secret put ADMIN_PASSWORD` y `npx wrangler secret put ADMIN_SESSION_SECRET` (opcional).
6. Ejecutar `npm run dev` para probar; luego `npm run deploy`..

## URLs
- Catálogo: `/`
- Administración: `/admin`

## Panel de administración (/admin)
- **Artículos**: alta, edición y baja. Campos: sección, categoría, código, nombre, marca, descripción, imagen (se sube desde el panel) y casilla "Mostrar en el sitio".
- **Secciones y categorías**: crear, renombrar, reordenar y eliminar. Son las tarjetas de "Qué vas a encontrar" del sitio.
- Los cambios se publican con **Guardar cambios**. Las imágenes subidas quedan en el KV (máx. 5 MB, se optimizan a WebP en el navegador).
- Una sección o categoría con artículos no se puede eliminar hasta mover o borrar esos artículos.
- Los secretos `ADMIN_USER` y `ADMIN_PASSWORD` se cargan en Cloudflare → Settings → Variables and secrets (la sección de runtime, no la de Builds).

## Pendientes antes de producción
- Confirmar que el Worker referencia el binding KV exclusivo de Murador.
- Probar inicio de sesión y alta/edición de productos.
- Añadir registro de usuarios persistente (esta versión conserva favoritos localmente; no implementa cuentas de cliente persistentes).
- Añadir carga de imágenes en el panel (actualmente se pueden referenciar imágenes en `public/assets/products/`).
- Validar visualmente logo, paleta exacta y tipografías con el PDF y el archivo de marca.
