# MURADOR EQUIPAMIENTOS — catálogo online

Proyecto separado de DECANTS PARANÁ. Base inicial de 63 códigos extraídos del Catálogo General Murador, edición 2026.

## Importante antes de publicar
- El catálogo inicial contiene los códigos del PDF y campos editables; hay que revisar los nombres, categorías y marcas extraídos y completar las fotografías reales. No se incluyen imágenes inventadas como si fueran fotos oficiales.
- El logo institucional definitivo debe extraerse/recibirse como archivo original para conservarlo fielmente. La M del encabezado es un marcador temporal, no reemplaza el logo oficial.
- El número de WhatsApp configurado según el PDF es 3434 62-7755. Verificar el formato internacional antes de producción.
- Este proyecto usa un Worker derivado del backend de referencia, con sesión admin y KV. Crear un namespace KV exclusivo y sustituir el ID de ejemplo en `wrangler.jsonc`.

## Instalación
1. Crear un repositorio nuevo `murador-equipamientos` en GitHub y subir todos los archivos.
2. Instalar Node.js LTS.
3. Ejecutar `npm install`.
4. Crear un KV exclusivo: `npx wrangler kv namespace create MURADOR` y copiar su ID en `wrangler.jsonc`. El binding se llama `DECANTS` solo por compatibilidad con el Worker de referencia: debe apuntar al namespace nuevo de Murador, nunca al namespace real de Decants.
5. Configurar secretos del Worker: `npx wrangler secret put ADMIN_USER`, `npx wrangler secret put ADMIN_PASSWORD` y `npx wrangler secret put SESSION_SECRET`.
6. Ejecutar `npm run dev` para probar; luego `npm run deploy`..

## URLs
- Catálogo: `/`
- Administración: `/admin.html`

## Pendientes antes de producción
- Confirmar que el Worker referencia el binding KV exclusivo de Murador.
- Probar inicio de sesión y alta/edición de productos.
- Añadir registro de usuarios persistente (esta versión conserva favoritos localmente; no implementa cuentas de cliente persistentes).
- Añadir carga de imágenes en el panel (actualmente se pueden referenciar imágenes en `public/assets/products/`).
- Validar visualmente logo, paleta exacta y tipografías con el PDF y el archivo de marca.
