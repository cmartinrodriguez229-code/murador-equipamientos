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
6. Para habilitar el checkout de Mercado Pago, cargar el Access Token de producción con el comando npx wrangler secret put MERCADOPAGO_ACCESS_TOKEN. El secreto se usa únicamente en el Worker; nunca se expone al navegador. Sin este secreto, el checkout muestra un mensaje de configuración pendiente y sigue disponible la solicitud de cuotas por WhatsApp.
7. Para probar el sandbox en el Worker desplegado, usa el Access Token de prueba como secreto MERCADOPAGO_ACCESS_TOKEN y agrega la variable de texto MERCADOPAGO_MODE con valor test. El Worker redirigirá al enlace sandbox_init_point. Para ventas reales, cambia el secreto por el Access Token de producción y define MERCADOPAGO_MODE como production.
8. Ejecutar npm run dev para revisar; luego npm run deploy.

## URLs
- Catálogo: `/`
- Administración: `/admin`

## Panel de administración (/admin)
- **Artículos**: alta, edición y baja. Campos: sección, categoría, código, nombre, marca, descripción, imagen, precio en ARS, opción para publicar u ocultar el precio y casilla "Mostrar en el sitio". Los importes iniciales se toman de la columna de precio de referencia estimado del Excel y quedan sin publicar para que se revisen primero.
- **Catálogo y carrito**: cuando el administrador publica un precio mayor que cero, el sitio muestra el importe y permite agregar el artículo al carrito. Si el precio está oculto o no tiene un importe válido, se conserva "Consultar precio".
- **Pago y cuotas**: el checkout crea una preferencia de Mercado Pago desde el Worker con los precios vigentes guardados en KV. La alternativa de cuotas personalizadas abre WhatsApp con el detalle y subtotal del carrito.
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
- Configurar MERCADOPAGO_ACCESS_TOKEN en Cloudflare antes de ofrecer pagos reales. El retorno de Mercado Pago devuelve al comprador al catálogo; esta versión no implementa notificaciones de pago ni conciliación de pedidos.
