
const $ = s => document.querySelector(s);

// Secciones por defecto (solo si la API no responde); en producción vienen del admin.
const DEFAULT_SECTIONS = [
  { name: "Industrial", categories: ["Gestión y venta", "Cocción", "Elaboración y procesamiento", "Frío y exhibición", "Mobiliario e infraestructura", "Envasado"] },
  { name: "Hogar", categories: ["Cocina", "Frío", "Lavado", "Pequeños electrodomésticos", "Climatización", "Audio y video", "Muebles", "Descanso"] },
  { name: "Exterior y Tiempo Libre", categories: ["Movilidad", "Jardín y parque", "Limpieza"] },
  { name: "Tecnología", categories: ["Consolas", "Informática", "Telefonía"] },
  { name: "Herramientas y Mantenimiento", categories: ["Herramientas eléctricas", "Aire comprimido"] }
];
let sections = DEFAULT_SECTIONS;

// Fichas por página según el ancho: 2 filas completas cuando entran 4 o más columnas (8, 10, 12…),
// 3 filas con 3 columnas (9) y 8 en celular. Replica la grilla de .products en styles.css.
const LANDSCAPE_PHONE = "(orientation:landscape) and (max-height:700px) and (max-width:1000px)"; // igual que la regla CSS de celular horizontal
function gridColumns() {
  const w = innerWidth;
  if (matchMedia(LANDSCAPE_PHONE).matches) return 3; // celular horizontal: 3 fichas por fila
  if (w <= 340) return 1;
  if (w <= 640) return 2;
  const box = document.getElementById("products");
  const avail = (box && box.clientWidth) || (w - 2 * Math.max(0.06 * w, 22));
  return Math.max(1, Math.floor((avail + 20) / 300)); // auto-fill cuenta con el ancho máximo de la columna (280px + 20px de separación)
}
function pageSize() {
  const cols = gridColumns();
  if (cols >= 4) return cols * 2;
  return cols === 3 ? 9 : 8;
}
let page = 1;

let all = [],
    favs = JSON.parse(localStorage.getItem("murador_favs") || "[]"),
    cart = JSON.parse(localStorage.getItem("murador_cart") || "{}");

const wa = "5493434627755";

/* ---------- PLAN 210 (cuotas diarias) ---------- */
const PLAN_DIAS = 210;
// Plan de cuotas del artículo (campo "plan" del admin): "210", "90", "120", "150", "180" o "contado".
// Sin plan cargado, las marcas con Plan 210 (Inelro y Sol Real) usan 210; el resto de las marcas queda como estaba.
const PLAN_BRANDS = ["inelro", "sol real"];
function planDays(p) {
  const plan = String(p.plan || "").trim().toLowerCase();
  if (plan === "contado") return 0;
  if (/^\d+$/.test(plan) && Number(plan) > 0) return Number(plan);
  return PLAN_BRANDS.includes(String(p.brand || "").trim().toLowerCase()) ? PLAN_DIAS : 0;
}
// Cuota diaria redondeada hacia arriba: la de la planilla/admin si existe; si no, precio / días del plan.
function dailyInstallment(p) {
  const days = planDays(p);
  if (!days) return 0;
  for (const k of ["installment", "dailyInstallment", "cuotaDiaria", "cuota", "redondeoCuota"]) {
    const v = Number(p[k]);
    if (v > 0) return Math.round(v);
  }
  if (Number(p.price) > 0) return Math.ceil(Number(p.price) / days - 1e-9);
  return 0;
}
// Planes ofrecidos en la ficha. Interés de cada plan (el de las planillas es 18% en el Plan 210).
// Cuando haya otros porcentajes, cambiarlos acá: cuota = precio × (1+interés del plan) ÷ (1+interés del plan base) ÷ días, redondeada hacia arriba.
const PLAN_OPTIONS = [90, 120, 150, 180, 210];
const PLAN_INTEREST = { 90: 0.18, 120: 0.18, 150: 0.18, 180: 0.18, 210: 0.18 };
// Cuota diaria de un plan elegido en la ficha (días). Para el plan propio del artículo usa la cuota de la planilla.
function installmentForPlan(p, days) {
  const own = planDays(p);
  if (!own || !days) return 0;
  if (days === own) return dailyInstallment(p);
  const own$ = dailyInstallment(p);
  const base = Number(p.price) > 0 ? Number(p.price) : own$ * own;
  if (!(base > 0)) return 0;
  const total = base * (1 + (PLAN_INTEREST[days] ?? 0.18)) / (1 + (PLAN_INTEREST[own] ?? 0.18));
  let c = Math.ceil(total / days - 1e-9);
  if (String(p.brand || "").trim().toLowerCase() === "sol real" && c % 2) c++; // Sol Real redondea al par (EVEN)
  return c;
}
const money = value => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value) || 0);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

async function load() {
  try {
    let r = await fetch("/api/catalog");
    if (!r.ok) throw 0;
    let d = await r.json();
    all = d.products || [];
    if (d.taxonomy && Array.isArray(d.taxonomy.sections) && d.taxonomy.sections.length) sections = d.taxonomy.sections;
  } catch {
    let r = await fetch("/seed-products.json");
    all = await r.json();
  }

  renderLines();
  populate();
  render();
  renderFavs();
}

function renderLines() {
  const visible = all.filter(p => p.visible !== false);
  const norm = v => String(v ?? "").trim().toLocaleLowerCase("es-AR");
  // el contador sale siempre del catálogo cargado: se actualiza solo al agregar, ocultar o quitar artículos
  const countOf = sec => visible.filter(p => norm(p.line) === norm(sec.name)).length;
  $("#lineButtons").innerHTML = sections.map(sec => `
    <button type="button" class="linebtn" data-line="${esc(sec.name)}">
      <span class="linebtn-count">${countOf(sec)} ${countOf(sec) === 1 ? "EQUIPO" : "EQUIPOS"}</span>
      <span class="linebtn-title">${esc(sec.name)}</span>
      <span class="linebtn-desc">${esc((sec.categories || []).filter(c => c.toLowerCase() !== "por clasificar").join(" · "))}</span>
    </button>
  `).join("");

  $("#lineButtons").querySelectorAll("button").forEach(b => {
    b.onclick = () => {
      $("#lineFilter").value = b.dataset.line;
      $("#categoryFilter").value = "";
      page = 1;
      render();
      $("#catalogo").scrollIntoView();
    };
  });
}

function populate() {
  const opts = (id, values, label, keepOrder) => {
    $(id).innerHTML = `<option value="">${label}</option>` +
      [...new Set(values.filter(Boolean))]
        .sort((a, b) => keepOrder ? 0 : a.localeCompare(b, "es"))
        .map(v => `<option>${esc(v)}</option>`)
        .join("");
  };

  opts("#lineFilter", sections.map(x => x.name), "Líneas", true);
  opts("#categoryFilter", all.map(p => p.category), "Categorías");
  opts("#brandFilter", all.map(p => p.brand), "Marcas");
}

function render() {
  let q = $("#search").value.toLowerCase();

  let list = all.filter(p =>
    p.visible !== false &&
    (!q || [p.code, p.name, p.brand, p.description].join(" ").toLowerCase().includes(q)) &&
    (!$("#lineFilter").value || p.line === $("#lineFilter").value) &&
    (!$("#categoryFilter").value || p.category === $("#categoryFilter").value) &&
    (!$("#brandFilter").value || p.brand === $("#brandFilter").value)
  );

  $("#clearFilters").disabled = !(q || $("#lineFilter").value || $("#categoryFilter").value || $("#brandFilter").value);
  $("#resultCount").textContent = `${list.length} artículos`;
  $("#empty").hidden = !!list.length;

  const PAGE_SIZE = pageSize();
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  renderPager(totalPages);

  $("#products").innerHTML = pageItems.map(p => `
    <article class="product" data-open="${esc(p.id)}" tabindex="0" aria-label="Ver ficha de ${esc(p.name)}">

      <!-- CÓDIGO Y CATEGORÍA: AHORA ANTES DE LA FOTO -->


      <div class="photo">
           <p class="code">${esc(p.code)}</p>
        <img
          src="${esc(p.image || "")}"
          alt="${esc(p.name)}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='block'"
        >
        <span class="placeholder" style="display:none">${esc(p.code.split("-")[0])}</span>
        <button
          class="heart ${favs.includes(p.id) ? "on" : ""}"
          data-fav="${esc(p.id)}"
          aria-label="Favorito"
        >${favs.includes(p.id) ? "♥" : "♡"}</button>
      </div>
<p class="code2">${esc(p.category)}</p>
      <h3>${esc(p.name)}</h3>
      <p class="meta">${esc(p.brand)}</p>
      <p class="desc">${esc(p.description || "Consultanos por especificaciones, precio y disponibilidad.")}</p>

      <div class="actions">
        <button class="consult" data-wa="${esc(p.id)}">CONSULTAR PRECIO</button>
        <button class="btn-sheet" type="button" data-sheet="${esc(p.id)}">VER FICHA</button>
      </div>

    </article>
  `).join("");

  $("#products").querySelectorAll("[data-wa]").forEach(b => {
    const p = all.find(x => x.id === b.dataset.wa);
    if (!p || p.pricePublished !== true || !(Number(p.price) > 0)) return;
    const price = document.createElement("div");
    price.className = "published-price";
    const cuota = dailyInstallment(p);
    if (cuota) {
      // Marcas con Plan 210 (Inelro, Sol Real): no se publica el valor total, solo la cuota diaria
      price.classList.add("plan-price");
      price.innerHTML = '<span class="plan-badge">PLAN ' + planDays(p) + ' · CUOTAS DIARIAS</span><span class="plan-amount">' + esc(money(cuota)) + ' <small>por día</small></span>';
    } else price.textContent = money(p.price);
    const add = document.createElement("button");
    add.className = "consult add-cart btn-buy";
    add.dataset.add = p.id;
    add.textContent = "COMPRAR";
    b.replaceWith(price, add);
  });

  $("#products").querySelectorAll("[data-fav]").forEach(b => {
    b.onclick = () => toggleFav(b.dataset.fav);
  });

  $("#products").querySelectorAll("[data-add]").forEach(b => {
    b.onclick = () => addToCart(b.dataset.add);
  });

  $("#products").querySelectorAll("[data-wa]").forEach(b => {
    b.onclick = () => {
      const p = all.find(x => x.id === b.dataset.wa);
      if (!p) return;
      window.open(
        "https://wa.me/" + wa + "?text=" + encodeURIComponent(waText(p)),
        "_blank", "noopener"
      );
    };
  });
}

/* ---------- PAGINADO ---------- */
const ARROW_L = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Cuántas posiciones (números y "…") entran en el ancho real del paginador. Debe coincidir con las medidas de .pg en styles.css.
function pagerSlots(nav) {
  const small = innerWidth <= 480;
  const btn = small ? 34 : 40, gap = small ? 3 : 6, arrow = small ? 38 : 46;
  const w = nav.clientWidth || (innerWidth - 2 * Math.max(0.06 * innerWidth, 22));
  return Math.max(5, Math.floor((w - 2 * arrow - gap) / (btn + gap)));
}

// Lista de páginas que llena el ancho disponible: 1 … 4 5 6 7 8 … 28 (slots = cantidad máxima de posiciones)
function pageList(total, cur, slots) {
  if (total <= slots) return Array.from({ length: total }, (_, i) => i + 1);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  if (cur <= slots - 3) return [...range(1, slots - 2), "…", total];                    // cerca del inicio
  if (cur >= total - (slots - 4)) return [1, "…", ...range(total - (slots - 3), total)]; // cerca del final
  const w = slots - 4;                                                                     // ventana central
  const start = Math.min(Math.max(cur - Math.floor((w - 1) / 2), 3), total - 2 - w);
  return [1, "…", ...range(start, start + w - 1), "…", total];
}

let lastTotalPages = 1;
function renderPager(total) {
  lastTotalPages = total;
  const nav = $("#pager");
  nav.hidden = total <= 1;
  if (total <= 1) { nav.innerHTML = ""; return; }
  const slots = pagerSlots(nav);

  nav.innerHTML =
    `<button type="button" class="pg pg-arrow" data-go="${page - 1}" aria-label="Página anterior" ${page === 1 ? "disabled" : ""}>${ARROW_L}</button>` +
    pageList(total, page, slots).map(n => n === "…"
      ? '<span class="pg pg-gap" aria-hidden="true">…</span>'
      : `<button type="button" class="pg${n === page ? " active" : ""}" data-go="${n}" aria-label="Página ${n}"${n === page ? ' aria-current="page"' : ""}>${n}</button>`
    ).join("") +
    `<button type="button" class="pg pg-arrow" data-go="${page + 1}" aria-label="Página siguiente" ${page === total ? "disabled" : ""}>${ARROW_R}</button>`;
}

$("#pager").addEventListener("click", e => {
  const b = e.target.closest("[data-go]");
  if (!b || b.disabled) return;
  page = Number(b.dataset.go);
  render();
  $("#catalogo").scrollIntoView({ behavior: "smooth" });
});

/* ---------- FAVORITOS ---------- */
function saveFavs() {
  localStorage.setItem("murador_favs", JSON.stringify(favs));
  pushFavs();
}

/* ---------- CLIENTE (Tus datos) ---------- */
const CUSTOMER_FIELDS = ["nombre", "apellido", "domicilio", "localidad", "telefono", "email"];
const REQUIRED = ["nombre", "apellido", "domicilio", "localidad", "telefono"];
let customer = null;
try { customer = JSON.parse(localStorage.getItem("murador_customer") || "null"); } catch {}

const phoneDigits = v => String(v || "").replace(/\D/g, "");
const customerComplete = () => !!customer && REQUIRED.every(k => String(customer[k] || "").trim());

function customerBlock() {
  if (!customerComplete()) return "";
  return "\n\nMis datos:\n" +
    "Nombre: " + customer.nombre + " " + customer.apellido + "\n" +
    "Domicilio: " + customer.domicilio + ", " + customer.localidad + "\n" +
    "Teléfono: " + customer.telefono +
    (customer.email ? "\nEmail: " + customer.email : "");
}

function waText(p) {
  return "Hola Murador Equipamientos, quisiera consultar por precio y disponibilidad de " + p.code + " — " + p.name + customerBlock();
}

function waFavsText(items) {
  return "Hola Murador Equipamientos, quisiera consultar por precio y disponibilidad de los siguientes productos:\n" +
    items.map(p => "• " + p.code + " — " + p.name).join("\n") + customerBlock();
}

let pushTimer;
function pushFavs() {
  if (!customer || phoneDigits(customer.telefono).length < 8) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    fetch("/api/customer", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: customer.telefono, favs, onlyFavs: true })
    }).catch(() => {});
  }, 600);
}

async function pullFavs() {
  if (!customer || phoneDigits(customer.telefono).length < 8) return;
  try {
    const r = await fetch("/api/customer?phone=" + encodeURIComponent(phoneDigits(customer.telefono)));
    const d = await r.json();
    if (!d.found) return;
    const merged = [...new Set([...favs, ...d.favs])];
    if (merged.length !== favs.length) {
      favs = merged;
      localStorage.setItem("murador_favs", JSON.stringify(favs));
      render(); renderFavs();
    }
  } catch {}
}

function fillCustomerForm() {
  if (!customer) return;
  CUSTOMER_FIELDS.forEach(k => { const el = document.querySelector('#customerForm [name="' + k + '"]'); if (el) el.value = customer[k] || ""; });
}

const cForm = $("#customerForm"), cMsg = $("#customerMsg");
function say(text, ok) { cMsg.textContent = text; cMsg.className = "datos-msg" + (ok ? " ok" : ""); }

cForm.addEventListener("submit", async e => {
  e.preventDefault();
  const data = {};
  CUSTOMER_FIELDS.forEach(k => { data[k] = cForm.elements[k].value.trim(); });
  let bad = false;
  CUSTOMER_FIELDS.forEach(k => cForm.elements[k].classList.remove("bad"));
  REQUIRED.forEach(k => { if (!data[k]) { cForm.elements[k].classList.add("bad"); bad = true; } });
  if (!bad && phoneDigits(data.telefono).length < 8) { cForm.elements.telefono.classList.add("bad"); bad = true; }
  if (!bad && data.email && !/^\S+@\S+\.\S+$/.test(data.email)) { cForm.elements.email.classList.add("bad"); bad = true; }
  if (bad) { say("Revisá los campos marcados.", false); return; }

  customer = data;
  localStorage.setItem("murador_customer", JSON.stringify(customer));
  say("Guardando…", true);
  try {
    const r = await fetch("/api/customer", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: data.telefono, ...data, favs, merge: true })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "error");
    favs = d.favs;
    localStorage.setItem("murador_favs", JSON.stringify(favs));
    render(); renderFavs();
    say("¡Listo! Tus datos y favoritos quedaron guardados.", true);
  } catch {
    say("Guardamos tus datos en este dispositivo, pero no pudimos sincronizar tus favoritos. Probá de nuevo más tarde.", false);
  }
});

// si el teléfono ya existe en otro dispositivo, se precarga el nombre
cForm.elements.telefono.addEventListener("blur", async () => {
  const d = phoneDigits(cForm.elements.telefono.value);
  if (d.length < 8 || (cForm.elements.nombre.value && cForm.elements.apellido.value)) return;
  try {
    const r = await (await fetch("/api/customer?phone=" + d)).json();
    if (r.found) {
      if (!cForm.elements.nombre.value) cForm.elements.nombre.value = r.nombre;
      if (!cForm.elements.apellido.value) cForm.elements.apellido.value = r.apellido;
      say("Encontramos tu cuenta. Completá el resto y guardá para recuperar tus favoritos.", true);
    }
  } catch {}
});

fillCustomerForm();

function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
  saveFavs();
  render();
  renderFavs();
}

function renderFavs() {
  const items = favs.map(id => all.find(p => p.id === id)).filter(Boolean);
  $("#favCount").textContent = items.length;
  $("#favConsult").disabled = !items.length;

  $("#favItems").innerHTML = items.length
    ? items.map(p => `
        <div class="favrow">
          <div class="favthumb">${p.image ? `<img src="${esc(p.image)}" alt="" onerror="this.remove()">` : ""}</div>
          <div class="favinfo">
            <b>${esc(p.name)}</b>
            <small>${esc(p.code)}</small>
          </div>
          <button class="favremove" data-remove="${esc(p.id)}" aria-label="Quitar ${esc(p.name)} de favoritos">×</button>
        </div>
      `).join("")
    : '<p class="favempty">Todavía no marcaste favoritos. Tocá el corazón de un artículo para guardarlo acá.</p>';

  $("#favItems").querySelectorAll("[data-remove]").forEach(b => {
    b.onclick = () => toggleFav(b.dataset.remove);
  });
}

$("#favConsult").addEventListener("click", () => {
  const items = favs.map(id => all.find(p => p.id === id)).filter(Boolean);
  if (!items.length) return;
  window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(waFavsText(items)), "_blank", "noopener");
});

function openFavs() {
  renderFavs();
  $("#favPanel").hidden = false;
  document.body.classList.add("modal-open");
}
function closeFavs() {
  $("#favPanel").hidden = true;
  document.body.classList.remove("modal-open");
}

$("#favOpen").onclick = openFavs;
$("#favClose").onclick = closeFavs;
$("#favPanel").onclick = e => { if (e.target.id === "favPanel") closeFavs(); };

/* ---------- CARRITO Y PAGO ---------- */
function saveCart() {
  localStorage.setItem("murador_cart", JSON.stringify(cart));
  renderCart();
}
function addToCart(id) {
  const p = all.find(x => x.id === id);
  if (!p || p.pricePublished !== true || !(Number(p.price) > 0)) return;
  cart[id] = Math.min(20, (Number(cart[id]) || 0) + 1);
  saveCart();
  openCart();
}
function cartItems() {
  return Object.entries(cart).map(([id, quantity]) => {
    const p = all.find(x => x.id === id);
    return p && p.pricePublished === true && p.visible !== false ? { ...p, quantity: Number(quantity) || 1 } : null;
  }).filter(Boolean);
}
function renderCart() {
  const items = cartItems();
  const count = items.reduce((n, p) => n + p.quantity, 0);
  $("#cartCount").textContent = count;
  const host = $("#cartItems");
  host.innerHTML = "";
  if (!items.length) host.innerHTML = '<p class="favempty">Todavía no agregaste artículos con precio publicado.</p>';
  items.forEach(p => {
    const row = document.createElement("div");
    row.className = "cartrow";
    row.innerHTML = '<div class="cartinfo"><b></b><small></small></div><div class="cartqty"><button data-qty data-delta="-1" aria-label="Quitar una unidad">−</button><span></span><button data-qty data-delta="1" aria-label="Agregar una unidad">+</button></div><button class="favremove" data-cart-remove aria-label="Quitar artículo">×</button>';
    row.querySelector(".cartinfo b").textContent = p.name;
    row.querySelector(".cartinfo small").textContent = p.code + " · " + money(p.price) + " c/u";
    row.querySelector(".cartqty span").textContent = p.quantity;
    row.querySelectorAll("[data-qty]").forEach(b => b.dataset.id = p.id);
    row.querySelector("[data-cart-remove]").dataset.id = p.id;
    host.append(row);
  });
  $("#cartSubtotal").textContent = money(items.reduce((n, p) => n + p.price * p.quantity, 0));
  $("#checkoutBtn").disabled = !items.length;
  $("#installmentsBtn").disabled = !items.length;
}
$("#cartItems").addEventListener("click", e => {
  const qty = e.target.closest("[data-qty]");
  const remove = e.target.closest("[data-cart-remove]");
  if (remove) delete cart[remove.dataset.id];
  else if (qty) {
    const id = qty.dataset.id;
    cart[id] = Math.max(0, Math.min(20, (Number(cart[id]) || 0) + Number(qty.dataset.delta)));
    if (!cart[id]) delete cart[id];
  } else return;
  saveCart();
});
async function checkout() {
  const items = cartItems();
  if (!items.length) return;
  const btn = $("#checkoutBtn");
  btn.disabled = true;
  btn.textContent = "Conectando con Mercado Pago…";
  try {
    const r = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: items.map(p => ({ id: p.id, quantity: p.quantity })) }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "No se pudo iniciar el pago.");
    location.href = d.initPoint;
  } catch (e) {
    alert(e.message);
    btn.disabled = false;
    btn.textContent = "PAGAR CON MERCADO PAGO";
  }
}
function requestInstallments() {
  const items = cartItems();
  if (!items.length) return;
  const lines = items.map(p => "• " + p.code + " — " + p.name + " x" + p.quantity + " — " + money(p.price * p.quantity)).join("\n");
  const total = items.reduce((n, p) => n + p.price * p.quantity, 0);
  const text = "Hola Murador Equipamientos, quisiera solicitar cuotas personalizadas para este pedido:\n" + lines + "\nTotal estimado: " + money(total);
  window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(text), "_blank", "noopener");
}
function openCart() {
  renderCart();
  $("#cartPanel").hidden = false;
  document.body.classList.add("modal-open");
}
function closeCart() {
  $("#cartPanel").hidden = true;
  document.body.classList.remove("modal-open");
}
$("#cartOpen").onclick = openCart;
$("#cartClose").onclick = closeCart;
$("#cartPanel").onclick = e => { if (e.target.id === "cartPanel") closeCart(); };
$("#checkoutBtn").onclick = checkout;
$("#installmentsBtn").onclick = requestInstallments;
renderCart();

/* ---------- FOTO AMPLIADA ---------- */
function openLightbox(src, alt) {
  $("#lbImg").src = src;
  $("#lbImg").alt = alt || "";
  $("#lightbox").hidden = false;
  document.body.classList.add("modal-open");
  $("#lbClose").focus();
}
function closeLightbox() {
  $("#lightbox").hidden = true;
  $("#lbLens").hidden = true;
  $("#lbImg").removeAttribute("src");
  if ($("#sheetModal").hidden) document.body.classList.remove("modal-open");
}

/* ---------- FICHA (popup VER FICHA) ---------- */
function openSheet(id) {
  const p = all.find(x => x.id === id);
  if (!p) return;
  const priced = p.pricePublished === true && Number(p.price) > 0;
  const img = $("#sheetImg");
  $("#sheetCode").textContent = p.code;
  $("#sheetTitle").textContent = p.name;
  $("#sheetMeta").textContent = [p.brand, p.category].filter(Boolean).join(" · ");
  $("#sheetDesc").textContent = p.description || "Consultanos por especificaciones, precio y disponibilidad.";
  const cuota = priced ? dailyInstallment(p) : 0;
  const sel = $("#sheetPlan");
  $("#sheetPlanBox").hidden = !cuota;
  $("#sheetPriceBox").hidden = !priced;
  const fin = $("#sheetFinance");
  fin.hidden = !cuota;
  $("#sheetFinanceNote").hidden = !cuota;
  fin.dataset.id = p.id;
  sel.dataset.id = p.id;
  if (cuota) {
    const own = planDays(p);
    sel.innerHTML = PLAN_OPTIONS.map(d => '<option value="' + d + '">PLAN ' + d + '</option>').join("");
    sel.value = String(own);
    if (sel.value !== String(own)) sel.insertAdjacentHTML("afterbegin", '<option value="' + own + '">PLAN ' + own + '</option>'), sel.value = String(own);
  }
  updateSheetPlan(p);
  if (p.image) { img.style.display = ""; img.src = p.image; img.alt = p.name; }
  else { img.removeAttribute("src"); img.style.display = "none"; }
  const buy = $("#sheetBuy");
  buy.textContent = priced ? "COMPRAR" : "CONSULTAR PRECIO";
  buy.dataset.id = p.id;
  buy.dataset.mode = priced ? "buy" : "wa";
  $("#sheetModal").hidden = false;
  document.body.classList.add("modal-open");
  $("#sheetModal .sheet-box").scrollTop = 0;
  $("#sheetClose").focus();
}
// Muestra la cuota diaria del plan elegido en el select
function updateSheetPlan(p) {
  const priced = p.pricePublished === true && Number(p.price) > 0;
  const days = Number($("#sheetPlan").value) || planDays(p);
  const cuota = priced && planDays(p) ? installmentForPlan(p, days) : 0;
  if (cuota) $("#sheetPrice").innerHTML = esc(money(cuota)) + ' <small>por día</small>';
  else $("#sheetPrice").textContent = priced ? money(p.price) : "";
  $("#sheetPlanBadge").hidden = !cuota;
  $("#sheetPlanBadge").textContent = "PLAN " + days + " · CUOTAS DIARIAS";
}
$("#sheetPlan").onchange = e => {
  const p = all.find(x => x.id === e.currentTarget.dataset.id);
  if (p) updateSheetPlan(p);
};
function closeSheet() {
  $("#sheetModal").hidden = true;
  document.body.classList.remove("modal-open");
}
$("#sheetImg").onerror = function () { this.style.display = "none"; };
$("#sheetImg").addEventListener("click", e => { if (e.target.getAttribute("src")) openLightbox(e.target.currentSrc || e.target.src, e.target.alt); });
$("#sheetClose").onclick = closeSheet;
$("#sheetModal").onclick = e => { if (e.target.id === "sheetModal") closeSheet(); };
$("#sheetBuy").onclick = e => {
  const { id, mode } = e.currentTarget.dataset;
  if (mode === "buy") { closeSheet(); addToCart(id); return; }
  const p = all.find(x => x.id === id);
  if (p) window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(waText(p)), "_blank", "noopener");
};
$("#sheetFinance").onclick = e => {
  const p = all.find(x => x.id === e.currentTarget.dataset.id);
  if (!p) return;
  const days = Number($("#sheetPlan").value) || planDays(p);
  const cuota = installmentForPlan(p, days);
  const text = "Hola Murador Equipamientos, quisiera consultar otra financiación para " + p.code + " — " + p.name +
    (cuota ? "\nVi el Plan " + days + ": " + days + " cuotas diarias de " + money(cuota) : "") +
    customerBlock();
  window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(text), "_blank", "noopener");
};
// Tocar cualquier parte de la ficha abre el popup, salvo los botones (COMPRAR, CONSULTAR PRECIO, favoritos).
// VER FICHA también abre el popup.
$("#products").addEventListener("click", e => {
  const art = e.target.closest("article.product");
  if (!art) return;
  const btn = e.target.closest("button, a");
  if (btn && !btn.matches("[data-sheet]")) return;
  openSheet(art.dataset.open);
});
$("#products").addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("article.product")) {
    e.preventDefault();
    openSheet(e.target.dataset.open);
  }
});
$("#lbClose").onclick = closeLightbox;

/* ---------- LUPA SOBRE LA FOTO AMPLIADA ---------- */
const LENS_ZOOM = 2.5;
const lbImg = $("#lbImg"), lens = $("#lbLens");
// Rectángulo real que ocupa la foto dentro del <img> (object-fit: contain deja bordes vacíos)
function lbPhotoRect() {
  const r = lbImg.getBoundingClientRect();
  const nw = lbImg.naturalWidth, nh = lbImg.naturalHeight;
  if (!nw || !nh) return r;
  const s = Math.min(r.width / nw, r.height / nh);
  const w = nw * s, h = nh * s;
  return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
}
function moveLens(e) {
  const ph = lbPhotoRect();
  const x = e.clientX - ph.left, y = e.clientY - ph.top;
  if (x < 0 || y < 0 || x > ph.width || y > ph.height) { hideLens(); return; }
  const size = lens.offsetWidth || 180;
  const touch = e.pointerType === "touch";
  // con el dedo la lupa se ubica arriba del punto tocado para que no la tape
  const cx = e.clientX, cy = e.clientY - (touch ? size * 0.8 : 0);
  lens.hidden = false;
  lens.style.left = (cx - size / 2) + "px";
  lens.style.top = (cy - size / 2) + "px";
  lens.style.backgroundImage = 'url("' + (lbImg.currentSrc || lbImg.src) + '")';
  lens.style.backgroundSize = (ph.width * LENS_ZOOM) + "px " + (ph.height * LENS_ZOOM) + "px";
  lens.style.backgroundPosition = (size / 2 - x * LENS_ZOOM) + "px " + (size / 2 - y * LENS_ZOOM) + "px";
}
function hideLens() { lens.hidden = true; }
lbImg.addEventListener("pointermove", e => {
  if (e.pointerType === "touch" && !(e.buttons & 1)) return;
  moveLens(e);
});
lbImg.addEventListener("pointerdown", e => { if (e.pointerType === "touch") moveLens(e); });
lbImg.addEventListener("pointerup", e => { if (e.pointerType === "touch") hideLens(); });
lbImg.addEventListener("pointercancel", hideLens);
lbImg.addEventListener("pointerleave", hideLens);
$("#lightbox").onclick = e => { if (e.target.id === "lightbox") closeLightbox(); };

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("#lightbox").hidden) closeLightbox();
  else if (!$("#sheetModal").hidden) closeSheet();
  else if (!$("#favPanel").hidden) closeFavs();
  else if (!$("#cartPanel").hidden) closeCart();
});

["#search", "#lineFilter", "#categoryFilter", "#brandFilter"].forEach(s => {
  $(s).addEventListener(s === "#search" ? "input" : "change", () => { page = 1; render(); });
});

/* al cambiar el ancho (girar el celular, redimensionar) se recalcula cuántas fichas entran */
let lastPageSize = pageSize(), resizeTimer;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const size = pageSize();
    if (size === lastPageSize) { renderPager(lastTotalPages); return; } // mismas fichas por página: solo se reacomodan los botones al nuevo ancho
    page = Math.floor(((page - 1) * lastPageSize) / size) + 1; // mantiene en pantalla el primer artículo que se estaba viendo
    lastPageSize = size;
    render();
  }, 150);
});

/* limpiar filtros */
$("#clearFilters").addEventListener("click", () => {
  $("#search").value = "";
  ["#lineFilter", "#categoryFilter", "#brandFilter"].forEach(s => { $(s).value = ""; });
  page = 1;
  render();
});

/* volver arriba */
const toTop = $("#toTop");
addEventListener("scroll", () => { toTop.hidden = scrollY < 600; }, { passive: true });
toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

load().then(pullFavs);
