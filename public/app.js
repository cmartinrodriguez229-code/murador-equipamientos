
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

const PAGE_SIZE = 8;
let page = 1;

let all = [],
    favs = JSON.parse(localStorage.getItem("murador_favs") || "[]");

const wa = "5493434627755";

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
  $("#lineButtons").innerHTML = sections.map(sec => `
    <button type="button" class="linebtn" data-line="${esc(sec.name)}">
      <span class="linebtn-count">${visible.filter(p => p.line === sec.name).length} EQUIPOS</span>
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

  $("#resultCount").textContent = `${list.length} artículos`;
  $("#empty").hidden = !!list.length;

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  renderPager(totalPages);

  $("#products").innerHTML = pageItems.map(p => `
    <article class="product">

      <!-- CÓDIGO Y CATEGORÍA: AHORA ANTES DE LA FOTO -->
 

      <div class="photo">
           <p class="code">${esc(p.code)}</p>
        <img
          class="zoomable"
          tabindex="0"
          role="button"
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
      </div>

    </article>
  `).join("");

  $("#products").querySelectorAll("[data-fav]").forEach(b => {
    b.onclick = () => toggleFav(b.dataset.fav);
  });

  $("#products").querySelectorAll("[data-wa]").forEach(b => {
    b.onclick = () => {
      const p = all.find(x => x.id === b.dataset.wa);
      if (!p) return;
      window.open(
        "https://wa.me/" + wa + "?text=" +
        encodeURIComponent("Hola Murador Equipamientos, quisiera consultar por precio y disponibilidad de " + p.code + " — " + p.name),
        "_blank", "noopener"
      );
    };
  });
}

/* ---------- PAGINADO ---------- */
const ARROW_L = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function pageList(total, cur) {
  // 1 … 4 5 6 … 8  (siempre como máximo 7 posiciones, para que entre en una sola línea)
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, cur - 1, cur, cur + 1]);
  if (cur <= 3) [2, 3, 4].forEach(n => set.add(n));
  if (cur >= total - 2) [total - 3, total - 2, total - 1].forEach(n => set.add(n));
  const nums = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

function renderPager(total) {
  const nav = $("#pager");
  nav.hidden = total <= 1;
  if (total <= 1) { nav.innerHTML = ""; return; }

  nav.innerHTML =
    `<button type="button" class="pg pg-arrow" data-go="${page - 1}" aria-label="Página anterior" ${page === 1 ? "disabled" : ""}>${ARROW_L}</button>` +
    pageList(total, page).map(n => n === "…"
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
}

function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
  saveFavs();
  render();
  renderFavs();
}

function renderFavs() {
  const items = favs.map(id => all.find(p => p.id === id)).filter(Boolean);
  $("#favCount").textContent = items.length;

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
  $("#lbImg").removeAttribute("src");
  document.body.classList.remove("modal-open");
}

$("#products").addEventListener("click", e => {
  const img = e.target.closest("img.zoomable");
  if (img && img.getAttribute("src")) openLightbox(img.currentSrc || img.src, img.alt);
});
$("#products").addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("img.zoomable")) {
    e.preventDefault();
    openLightbox(e.target.currentSrc || e.target.src, e.target.alt);
  }
});
$("#lbClose").onclick = closeLightbox;
$("#lightbox").onclick = e => { if (e.target.id === "lightbox") closeLightbox(); };

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("#lightbox").hidden) closeLightbox();
  else if (!$("#favPanel").hidden) closeFavs();
});

["#search", "#lineFilter", "#categoryFilter", "#brandFilter"].forEach(s => {
  $(s).addEventListener(s === "#search" ? "input" : "change", () => { page = 1; render(); });
});

/* volver arriba */
const toTop = $("#toTop");
addEventListener("scroll", () => { toTop.hidden = scrollY < 600; }, { passive: true });
toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

load();
