# DECANTS PARANA v6.1 · Cloudflare

Sitio estático + un Worker que atiende `/api/*` (catálogo, login, guardado, fotos).
Datos y fotos subidas desde el panel viven en un KV. Las 139 fotos actuales ya vienen
incluidas en `public/fotos/` y los 191 productos + la configuración, en
`public/seed-products.json` y `public/seed-settings.json`: **no hay que importar nada a mano**.
La primera vez que entres al panel, se copian al KV.

## Despliegue (una sola vez)

1. **Subí esta carpeta a tu repo de GitHub** (reemplazando el contenido anterior).
2. En Cloudflare: **Storage & databases → KV → Create** → nombre `decants-parana`.
   Copiá el **ID** del namespace y pegalo en `wrangler.jsonc`, en lugar de `PEGAR_ID_DEL_KV_AQUI`
   (podés editarlo desde GitHub). Subí el cambio.
3. **Workers & Pages → Create → Import a repository** → elegí el repo.
   - Nombre del proyecto: `decants-parana`
   - Build command: *(vacío)*
   - Deploy command: `npx wrangler deploy`
4. Cuando termine el primer despliegue: **Worker `decants-parana` → Settings → Variables and Secrets**, agregá como **Secret**:
   - `ADMIN_USER` → tu usuario
   - `ADMIN_PASSWORD` → tu contraseña
   - `ADMIN_SESSION_SECRET` → cualquier texto largo y aleatorio
5. Abrí `https://decants-parana.<tu-subdominio>.workers.dev/admin`, ingresá, y probá subir una foto y "Guardar cambios".

Alternativa por consola: `npm install`, `npx wrangler kv namespace create DECANTS`, pegar el ID en `wrangler.jsonc`, `npx wrangler secret put ADMIN_USER` (idem las otras dos) y `npx wrangler deploy`.

## Cómo funciona

- `public/` se sirve como archivos estáticos (gratis e ilimitado). El Worker solo corre para `/api/*`.
- `/api/image/<id>`: si subiste una foto desde el panel, sale del KV; si no, sale de `public/fotos/<id>.webp`.
- Los productos sin foto subida (47 con ilustración provisoria) siguen usando `public/assets/perfumes/`.
- Para cambiar el usuario o la contraseña, editá los secretos del punto 4.

## Nota

`seed-products.json` y `seed-settings.json` solo se usan si el KV está vacío. Después manda lo que guardes en el panel.

## Novedades v6.1: favoritos (♥) y cuentas de clientes

- Cada perfume tiene un corazón en el listado y en la ficha. Junto al carrito hay un botón **Favoritos** que despliega la lista (orden A→Z, con miniatura y enlace a la ficha).
- Sin haber completado "Mis datos", los favoritos se guardan en el dispositivo. Al completar y guardar **Mis datos** se crea la cuenta del cliente en el KV y los favoritos quedan vinculados a ella (se sincronizan entre dispositivos).
- La cuenta se identifica por el **teléfono** (no hay contraseña). Si alguien carga un teléfono que ya existe desde otro dispositivo, recupera los favoritos, pero **no** se pisan ni se muestran los datos guardados.
- "Mis datos" tiene un campo **Email (opcional)**.
- Nuevos endpoints públicos: `POST /api/customer` y `GET/POST /api/favorites` (usan un token firmado que se guarda en el navegador). Requieren que exista el secreto `ADMIN_SESSION_SECRET` (o `ADMIN_PASSWORD`).
- En el KV se guardan como `cust:<id>` (datos y favoritos) y `custphone:<teléfono>` (índice). Se pueden ver desde Cloudflare → KV → *View*.
- Enlace directo a una ficha: `https://tu-sitio/#ficha/<id-del-perfume>`.
