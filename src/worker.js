// MURADOR EQUIPAMIENTOS - backend del catálogo y del panel /admin sobre Cloudflare Workers + KV.
// Datos y fotos subidas desde el panel se guardan en un único KV (binding MURADOR).
// Las fotos originales viajan como archivos estáticos en /fotos/<id>.webp y se usan si no hay una foto subida.

const PRODUCTS_KEY = "catalog:products";
const SETTINGS_KEY = "catalog:settings";
const TAXONOMY_KEY = "catalog:taxonomy";
const IMG_PREFIX = "img:";
const SESSION_COOKIE = "murador_admin_session";
const SESSION_HOURS = 12;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const enc = new TextEncoder();

const defaultSettings = {
  siteName: "MURADOR EQUIPAMIENTOS",
  heroEyebrow: "100 % ORIGINALES",
  heroTitle: "Equipamos tu presente,",
  heroTitleAccent: "impulsamos tu futuro.",
  heroText: "Elegí tu fragancia, seleccioná 5 ml o 10 ml y armá tu pedido. Recibimos pedidos por WhatsApp y el pago se realiza únicamente por transferencia.",
  catalogEyebrow: "CATÁLOGO",
  catalogTitle: "Elegí tu fragancia",
  howEyebrow: "SIMPLE Y DIRECTO",
  howTitle: "Cómo comprar",
  contactTitle: "¿Tenés una consulta?",
  contactText: "Escribinos por WhatsApp y te ayudamos con disponibilidad, entrega y medios de pago.",
  footerText: "MURADOR EQUIPAMIENTOS · Perfumes en 5 ml y 10 ml",
  price5: 12000,
  price10: 18000,
  currency: "ARS",
  primaryColor: "#b88952",
  accentColor: "#b88952",
  backgroundColor: "#f7f5f1",
  cardColor: "#ffffff",
  textColor: "#1f2937",
  mutedColor: "#6b7280",
  fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
};

// Secciones (líneas) y sus categorías. Se editan desde /admin; esto es solo el punto de partida.
const defaultTaxonomy = {
  sections: [
    { name: "Industrial", categories: ["Gestión y venta", "Cocción", "Elaboración y procesamiento", "Frío y exhibición", "Mobiliario e infraestructura", "Envasado"] },
    { name: "Hogar", categories: ["Cocina", "Frío", "Lavado", "Pequeños electrodomésticos", "Climatización", "Audio y video", "Muebles", "Descanso"] },
    { name: "Exterior y Tiempo Libre", categories: ["Movilidad", "Jardín y parque", "Limpieza"] },
    { name: "Tecnología", categories: ["Consolas", "Informática", "Telefonía"] },
    { name: "Herramientas y Mantenimiento", categories: ["Herramientas eléctricas", "Aire comprimido"] }
  ]
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });
}

// ---------- sesión (cookie firmada con HMAC) ----------
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function sha256(text) { return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(text)))); }
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}
async function hmacKey(env) {
  const base = env.ADMIN_SESSION_SECRET || `${env.ADMIN_USER || ""}:${env.ADMIN_PASSWORD || ""}:murador-amoblamientos`;
  return crypto.subtle.importKey("raw", enc.encode(base), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
async function sign(env, value) { return b64url(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(value))); }
async function makeSession(env, user) {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: Date.now() + SESSION_HOURS * 3600 * 1000 })));
  return `${payload}.${await sign(env, payload)}`;
}
function cookies(req) {
  const raw = req.headers.get("cookie") || "";
  return Object.fromEntries(raw.split(/;\s*/).filter(Boolean).map((x) => {
    const i = x.indexOf("=");
    return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
async function validSession(env, req) {
  const token = cookies(req)[SESSION_COOKIE];
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !(await safeEqual(sig, await sign(env, payload)))) return false;
  try { return JSON.parse(new TextDecoder().decode(fromB64url(payload))).exp > Date.now(); } catch { return false; }
}
const cookieHeader = (token, maxAge = SESSION_HOURS * 3600) =>
  `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// ---------- almacenamiento ----------
function requireKV(env) {
  if (!env.MURADOR) throw new HttpError(503, "Falta conectar el KV (binding MURADOR) al Worker. Revisá wrangler.jsonc y volvé a desplegar.");
}
async function seedFile(env, req, name) {
  const r = await env.ASSETS.fetch(new URL(`/${name}`, req.url));
  if (!r.ok) throw new HttpError(500, `No se pudo leer ${name}`);
  return r.json();
}
const normalizeSeed = (seed) => seed.map((p) => ({ ...p, visible: p.visible !== false }));

async function getProducts(env, req, { persistSeed = true } = {}) {
  requireKV(env);
  let data = await env.MURADOR.get(PRODUCTS_KEY, "json");
  if (!data) {
    data = normalizeSeed(await seedFile(env, req, "seed-products.json"));
    if (persistSeed) await env.MURADOR.put(PRODUCTS_KEY, JSON.stringify(data));
  }
  return data;
}
async function getSettings(env, req) {
  requireKV(env);
  let saved = await env.MURADOR.get(SETTINGS_KEY, "json");
  if (!saved) saved = await seedFile(env, req, "seed-settings.json").catch(() => ({}));
  return { ...defaultSettings, ...saved };
}

const txt = (v, max) => String(v ?? "").trim().slice(0, max);

function cleanProduct(p) {
  const code = txt(p.code, 40);
  const name = txt(p.name, 160);
  const line = txt(p.line, 80);
  if (!code) throw new HttpError(400, "Cada artículo necesita un código.");
  if (!name) throw new HttpError(400, `El artículo ${code} necesita un nombre.`);
  if (!line) throw new HttpError(400, `El artículo ${code} necesita una sección.`);
  return {
    id: safeId(txt(p.id, 120) || code.toLowerCase()),
    code, name, line,
    category: txt(p.category, 80),
    brand: txt(p.brand, 120),
    description: txt(p.description, 1500),
    image: txt(p.image, 400),
    visible: p.visible !== false,
    featured: p.featured === true
  };
}

function cleanTaxonomy(t) {
  const sections = Array.isArray(t?.sections) ? t.sections : [];
  const seen = new Set();
  const out = [];
  for (const sec of sections) {
    const name = txt(sec?.name, 80);
    if (!name) throw new HttpError(400, "Hay una sección sin nombre.");
    if (seen.has(name.toLowerCase())) throw new HttpError(400, `La sección "${name}" está repetida.`);
    seen.add(name.toLowerCase());
    const cats = [];
    for (const c of Array.isArray(sec.categories) ? sec.categories : []) {
      const cn = txt(c, 80);
      if (cn && !cats.some((x) => x.toLowerCase() === cn.toLowerCase())) cats.push(cn);
    }
    out.push({ name, categories: cats });
  }
  return { sections: out };
}

// Une lo guardado con las secciones/categorías que usan los artículos, para que nunca falte ninguna.
function buildTaxonomy(saved, products) {
  const base = cleanTaxonomy(saved?.sections ? saved : defaultTaxonomy);
  for (const p of products) {
    if (!p.line) continue;
    let sec = base.sections.find((x) => x.name === p.line);
    if (!sec) { sec = { name: p.line, categories: [] }; base.sections.push(sec); }
    if (p.category && !sec.categories.includes(p.category)) sec.categories.push(p.category);
  }
  return base;
}
async function getTaxonomy(env, products) {
  requireKV(env);
  return buildTaxonomy(await env.MURADOR.get(TAXONOMY_KEY, "json"), products);
}

const decode = (v) => { try { return decodeURIComponent(v); } catch { return v; } };
const safeId = (id) => String(id).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"]);

// ---------- fotos ----------
async function serveImage(env, req, ctx, id) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(req.url).origin + new URL(req.url).pathname + new URL(req.url).search, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let res;
  const hasVersion = new URL(req.url).searchParams.has("v");
  const cc = hasVersion ? "public, max-age=31536000, immutable" : "public, max-age=300";
  const { value, metadata } = await env.MURADOR.getWithMetadata(IMG_PREFIX + id, "arrayBuffer");
  if (value) {
    res = new Response(value, { headers: { "content-type": metadata?.type || "image/webp", "cache-control": cc } });
  } else {
    // sin foto subida desde el panel: se usa la foto original incluida en el sitio
    const r = await env.ASSETS.fetch(new URL(`/fotos/${id}.webp`, req.url));
    if (!r.ok) return new Response("Not found", { status: 404 });
    res = new Response(r.body, { headers: { "content-type": "image/webp", "cache-control": cc } });
  }
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const method = req.method;
  try {
    if (method === "GET" && path === "catalog") {
      const [products, settings] = await Promise.all([getProducts(env, req, { persistSeed: false }), getSettings(env, req)]);
      const visible = products.filter((p) => p.visible !== false);
      return json({ products: visible, settings, taxonomy: await getTaxonomy(env, visible) }, 200, { "cache-control": "no-store" });
    }
    if (method === "POST" && path === "login") {
      const body = await req.json().catch(() => ({}));
      const user = env.ADMIN_USER || "";
      const pass = env.ADMIN_PASSWORD || "";
      if (!user || !pass) return json({ error: "Faltan configurar los secretos ADMIN_USER y ADMIN_PASSWORD en Cloudflare." }, 503);
      const okUser = await safeEqual(body.username ?? "", user);
      const okPass = await safeEqual(body.password ?? "", pass);
      if (!okUser || !okPass) return json({ error: "Usuario o contraseña incorrectos." }, 401);
      return json({ ok: true, user }, 200, { "set-cookie": cookieHeader(await makeSession(env, user)) });
    }
    if (method === "POST" && path === "logout") return json({ ok: true }, 200, { "set-cookie": cookieHeader("", 0) });
    if (method === "GET" && path === "session") return json({ authenticated: await validSession(env, req) });

    if (method === "GET" && path.startsWith("image/")) {
      requireKV(env);
      return serveImage(env, req, ctx, safeId(decode(path.slice(6))));
    }

    if (!(await validSession(env, req))) return json({ error: "No autorizado." }, 401);

    if (method === "GET" && path === "admin") {
      const products = await getProducts(env, req);
      return json({ products, taxonomy: await getTaxonomy(env, products) });
    }
    if (method === "PUT" && path === "products") {
      requireKV(env);
      const body = await req.json();
      const products = (Array.isArray(body.products) ? body.products : []).map(cleanProduct);
      if (products.length > 3000) throw new HttpError(400, "Demasiados artículos.");
      const ids = new Set(), codes = new Set();
      for (const p of products) {
        if (ids.has(p.id)) throw new HttpError(400, `El código ${p.code} está repetido.`);
        if (codes.has(p.code.toLowerCase())) throw new HttpError(400, `El código ${p.code} está repetido.`);
        ids.add(p.id); codes.add(p.code.toLowerCase());
      }
      const previous = (await env.MURADOR.get(PRODUCTS_KEY, "json")) || [];
      await env.MURADOR.put(PRODUCTS_KEY, JSON.stringify(products));
      // borra las fotos subidas de los artículos eliminados
      await Promise.all(previous.filter((p) => !ids.has(p.id)).map((p) => env.MURADOR.delete(IMG_PREFIX + safeId(p.id))));
      return json({ ok: true, count: products.length });
    }
    if (method === "PUT" && path === "taxonomy") {
      requireKV(env);
      const taxonomy = cleanTaxonomy(await req.json());
      await env.MURADOR.put(TAXONOMY_KEY, JSON.stringify(taxonomy));
      return json({ ok: true, taxonomy });
    }
    if (method === "DELETE" && path.startsWith("image/")) {
      requireKV(env);
      await env.MURADOR.delete(IMG_PREFIX + safeId(decode(path.slice(6))));
      return json({ ok: true });
    }
    if (method === "PUT" && path === "settings") {
      requireKV(env);
      const body = await req.json();
      const current = await getSettings(env, req);
      const next = {
        ...current, ...body,
        price5: Math.max(0, Number(body.price5 ?? current.price5) || 0),
        price10: Math.max(0, Number(body.price10 ?? current.price10) || 0)
      };
      await env.MURADOR.put(SETTINGS_KEY, JSON.stringify(next));
      return json({ ok: true, settings: next });
    }
    if (method === "POST" && path.startsWith("image/")) {
      requireKV(env);
      const id = safeId(decode(path.slice(6)));
      const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!IMAGE_TYPES.has(type)) return json({ error: "Formato de imagen no admitido." }, 415);
      const buf = await req.arrayBuffer();
      if (!buf.byteLength) return json({ error: "No se recibió una imagen." }, 400);
      if (buf.byteLength > MAX_IMAGE_BYTES) return json({ error: "La imagen supera el límite de 5 MB." }, 413);
      await env.MURADOR.put(IMG_PREFIX + id, buf, { metadata: { type } });
      return json({ ok: true, url: `/api/image/${encodeURIComponent(id)}?v=${Date.now()}` });
    }
    return json({ error: "Ruta no encontrada." }, 404);
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return json({ error: e.message || "Error interno." }, e instanceof HttpError ? e.status : 500);
  }
}

export default { fetch: handle };
