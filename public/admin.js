"use strict";
/* Panel de administración · Murador Equipamientos
   Artículos, secciones y categorías. Los cambios se editan en pantalla y se publican con "Guardar cambios". */

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NEW = "__new";

let products = [];
let taxonomy = { sections: [] };
let dirty = false;
let editing = null;            // artículo que se está editando (null = nuevo)
let form = { file: null, preview: "", clear: false };

/* ---------- API ---------- */
async function api(path, { method = "GET", body, raw, type } = {}) {
  const headers = {};
  let payload;
  if (raw) { headers["content-type"] = type; payload = raw; }
  else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch("/api/" + path, { method, headers, body: payload, credentials: "same-origin" });
  let data = {};
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (res.status === 401 && path !== "login") { showLogin("La sesión venció. Ingresá de nuevo."); throw new Error("Sesión vencida"); }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/* ---------- acceso ---------- */
function showLogin(msg = "") {
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#loginMsg").textContent = msg;
}
async function openApp() {
  $("#login").hidden = true;
  $("#app").hidden = false;
  await load();
}
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#loginMsg").textContent = "";
  try {
    await api("login", { method: "POST", body: { username: $("#user").value, password: $("#pass").value } });
    $("#pass").value = "";
    await openApp();
  } catch (err) { $("#loginMsg").textContent = err.message; }
});
$("#logout").addEventListener("click", async () => {
  if (dirty && !confirm("Hay cambios sin guardar. ¿Salir igual?")) return;
  dirty = false;
  try { await api("logout", { method: "POST" }); } catch { /* ignorar */ }
  location.reload();
});

/* ---------- carga ---------- */
async function load() {
  const d = await api("admin");
  products = d.products || [];
  taxonomy = d.taxonomy || { sections: [] };
  setDirty(false);
  renderAll();
}

function setDirty(v, msg) {
  dirty = v;
  const bar = $("#savebar");
  bar.classList.toggle("dirty", v);
  bar.classList.remove("error", "ok");
  $("#status").textContent = msg || (v ? "Hay cambios sin guardar" : "Todo guardado");
}
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- pestañas ---------- */
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
  $("#tab-products").hidden = t.dataset.tab !== "products";
  $("#tab-taxonomy").hidden = t.dataset.tab !== "taxonomy";
}));

/* ---------- utilidades ---------- */
const sectionNames = () => taxonomy.sections.map((s) => s.name);
const sectionByName = (n) => taxonomy.sections.find((s) => s.name === n);
const countIn = (line, cat) => products.filter((p) => p.line === line && (cat === undefined || p.category === cat)).length;
const imgOf = (p) => p._preview || p.image || "";
function slug(code) { return String(code).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "item"; }
function uniqueId(code, ignore) {
  let id = slug(code), n = 2;
  while (products.some((p) => p !== ignore && p.id === id)) id = `${slug(code)}-${n++}`;
  return id;
}
function optionList(values, selected, placeholder) {
  return (placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : "") +
    values.map((v) => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
}

/* ---------- render general ---------- */
function renderAll() { renderFilters(); renderRows(); renderTaxonomy(); }

function renderFilters() {
  const sec = $("#fSection").value, cat = $("#fCategory").value;
  $("#fSection").innerHTML = optionList(sectionNames(), sec, "Todas las secciones");
  if (!sectionNames().includes(sec)) $("#fSection").value = "";
  const cats = $("#fSection").value ? (sectionByName($("#fSection").value)?.categories || []) : [...new Set(taxonomy.sections.flatMap((s) => s.categories))];
  $("#fCategory").innerHTML = optionList(cats, cat, "Todas las categorías");
  if (!cats.includes(cat)) $("#fCategory").value = "";
}
["#q", "#fCategory", "#fVisible"].forEach((s) => $(s).addEventListener("input", renderRows));
$("#fSection").addEventListener("change", () => { $("#fCategory").value = ""; renderFilters(); renderRows(); });

function filtered() {
  const q = $("#q").value.trim().toLowerCase();
  const sec = $("#fSection").value, cat = $("#fCategory").value, vis = $("#fVisible").value;
  return products.filter((p) =>
    (!q || [p.code, p.name, p.brand, p.description].join(" ").toLowerCase().includes(q)) &&
    (!sec || p.line === sec) && (!cat || p.category === cat) &&
    (!vis || (vis === "1") === (p.visible !== false)));
}

function renderRows() {
  const list = filtered();
  const vis = products.filter((p) => p.visible !== false).length;
  $("#counts").textContent = `${products.length} artículos · ${vis} visibles · ${products.length - vis} ocultos`;
  $("#empty").hidden = list.length > 0;
  $("#table").hidden = list.length === 0;
  $("#rows").innerHTML = list.map((p) => {
    const on = p.visible !== false;
    const img = imgOf(p);
    return `<div class="row${on ? "" : " hidden-item"}" role="row" data-id="${esc(p.id)}">
      <label class="vis" title="Mostrar u ocultar en el sitio">
        <input type="checkbox" data-vis ${on ? "checked" : ""} aria-label="Mostrar ${esc(p.code)}">
        <span>${on ? "Visible" : "Oculto"}</span>
      </label>
      <div class="thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('Sin foto'))">` : "Sin foto"}</div>
      <div class="name"><small>${esc(p.code)}</small><b>${esc(p.name)}</b></div>
      <div class="sec"><b>${esc(p.line)}</b><small>${esc(p.category || "Sin categoría")}</small></div>
      <div class="brandcell">${esc(p.brand)}</div>
      <div class="acts">
        <button class="btn sm" data-edit type="button">Editar</button>
        <button class="btn sm danger-o" data-del type="button">Eliminar</button>
      </div>
    </div>`;
  }).join("");
}
$("#rows").addEventListener("click", (e) => {
  const row = e.target.closest(".row"); if (!row) return;
  const p = products.find((x) => x.id === row.dataset.id); if (!p) return;
  if (e.target.closest("[data-edit]")) openForm(p);
  else if (e.target.closest("[data-del]")) deleteProduct(p);
});
$("#rows").addEventListener("change", (e) => {
  if (!e.target.matches("[data-vis]")) return;
  const row = e.target.closest(".row");
  const p = products.find((x) => x.id === row.dataset.id); if (!p) return;
  p.visible = e.target.checked;
  row.classList.toggle("hidden-item", !p.visible);
  row.querySelector(".vis span").textContent = p.visible ? "Visible" : "Oculto";
  const vis = products.filter((x) => x.visible !== false).length;
  $("#counts").textContent = `${products.length} artículos · ${vis} visibles · ${products.length - vis} ocultos`;
  setDirty(true);
});

function deleteProduct(p) {
  if (!confirm(`¿Eliminar "${p.name}" (${p.code})? Se borra definitivamente al guardar.`)) return;
  products = products.filter((x) => x !== p);
  setDirty(true);
  renderRows();
  renderTaxonomy();
}

/* ---------- formulario de artículo ---------- */
const dlg = $("#dlg");

function fillSections(selected) {
  $("#fSec").innerHTML = optionList(sectionNames(), selected) + `<option value="${NEW}">+ Nueva sección…</option>`;
  $("#fSec").value = sectionNames().includes(selected) ? selected : (sectionNames()[0] || NEW);
}
function fillCategories(selected) {
  const cats = sectionByName($("#fSec").value)?.categories || [];
  const list = selected && !cats.includes(selected) ? [...cats, selected] : cats;
  $("#fCat").innerHTML = optionList(list, selected, "— Sin categoría —") + `<option value="${NEW}">+ Nueva categoría…</option>`;
  $("#fCat").value = selected || "";
}
function showPreview(src) {
  $("#imgPrev").innerHTML = src ? `<img src="${esc(src)}" alt="Vista previa">` : "<span>Sin imagen</span>";
  $("#rmImg").hidden = !src;
}

function openForm(p) {
  editing = p || null;
  form = { file: null, preview: p ? imgOf(p) : "", clear: false };
  $("#dlgTitle").textContent = p ? `Editar ${p.code}` : "Nuevo artículo";
  $("#formErr").textContent = "";
  const sec = p ? p.line : ($("#fSection").value || sectionNames()[0] || "");
  fillSections(sec);
  fillCategories(p ? p.category : ($("#fCategory").value || ""));
  $("#fCode").value = p ? p.code : "";
  $("#fBrand").value = p ? p.brand : "";
  $("#fName").value = p ? p.name : "";
  $("#fDesc").value = p ? p.description : "";
  $("#fPrice").value = p && p.price != null ? p.price : "";
  $("#fPriceYes").checked = !!(p && p.pricePublished === true);
  $("#fPriceNo").checked = !(p && p.pricePublished === true);
  $("#fVisibleChk").checked = p ? p.visible !== false : true;
  $("#fFile").value = "";
  showPreview(form.preview);
  dlg.showModal();
  (p ? $("#fName") : $("#fCode")).focus();
}
$("#newProduct").addEventListener("click", () => openForm(null));

$("#fSec").addEventListener("change", () => {
  if ($("#fSec").value === NEW) {
    const name = (prompt("Nombre de la nueva sección:") || "").trim();
    if (!name) return fillSections(editing ? editing.line : sectionNames()[0]);
    if (!sectionByName(name)) { taxonomy.sections.push({ name, categories: [] }); setDirty(true); renderFilters(); renderTaxonomy(); }
    fillSections(name);
  }
  fillCategories("");
});
$("#fCat").addEventListener("change", () => {
  if ($("#fCat").value !== NEW) return;
  const sec = sectionByName($("#fSec").value);
  const name = (prompt("Nombre de la nueva categoría:") || "").trim();
  if (!name || !sec) return fillCategories("");
  if (!sec.categories.some((c) => c.toLowerCase() === name.toLowerCase())) { sec.categories.push(name); setDirty(true); renderFilters(); renderTaxonomy(); }
  fillCategories(sec.categories.find((c) => c.toLowerCase() === name.toLowerCase()));
});

/* imagen: se optimiza en el navegador (WebP, máx. 1400 px) antes de subirla */
async function optimize(file) {
  if (!file.type.startsWith("image/")) throw new Error("El archivo no es una imagen.");
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.86));
    if (blob && blob.type === "image/webp" && (scale < 1 || blob.size < file.size)) return blob;
  } catch { /* si el navegador no puede, se sube el original */ }
  return file;
}
$("#pickImg").addEventListener("click", () => $("#fFile").click());
$("#fFile").addEventListener("change", async () => {
  const f = $("#fFile").files[0]; if (!f) return;
  $("#formErr").textContent = "";
  try {
    const blob = await optimize(f);
    if (blob.size > 5 * 1024 * 1024) throw new Error("La imagen supera los 5 MB.");
    if (form.preview.startsWith("blob:")) URL.revokeObjectURL(form.preview);
    form = { file: blob, preview: URL.createObjectURL(blob), clear: false };
    showPreview(form.preview);
  } catch (err) { $("#formErr").textContent = err.message; }
});
$("#rmImg").addEventListener("click", () => {
  form = { file: null, preview: "", clear: true };
  $("#fFile").value = "";
  showPreview("");
});

$("#productForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const line = $("#fSec").value === NEW ? "" : $("#fSec").value;
  const category = $("#fCat").value === NEW ? "" : $("#fCat").value;
  const code = $("#fCode").value.trim(), name = $("#fName").value.trim();
  const err = (m) => { $("#formErr").textContent = m; };
  if (!line) return err("Elegí una sección.");
  if (!code) return err("Completá el código.");
  if (!name) return err("Completá el nombre.");
  if ($("#fPrice").value !== "" && (!Number.isFinite(Number($("#fPrice").value)) || Number($("#fPrice").value) < 0)) return err("Ingresá un precio válido en pesos.");
  if ($("#fPriceYes").checked && Number($("#fPrice").value) <= 0) return err("Para publicar, ingresá un precio mayor a cero.");
  if (products.some((p) => p !== editing && p.code.toLowerCase() === code.toLowerCase())) return err(`Ya existe un artículo con el código ${code}.`);

  const p = editing || { id: uniqueId(code), featured: false };
  Object.assign(p, {
    line, category, code, name,
    brand: $("#fBrand").value.trim(),
    description: $("#fDesc").value.trim(),
    price: $("#fPrice").value === "" ? null : Number($("#fPrice").value),
    pricePublished: $("#fPriceYes").checked && Number($("#fPrice").value) > 0,
    visible: $("#fVisibleChk").checked
  });
  if (form.file) { p._file = form.file; p._preview = form.preview; p._clear = false; }
  else if (form.clear) { p.image = ""; p._file = null; p._preview = ""; p._clear = true; }
  if (!editing) products.unshift(p);

  // asegura que la sección/categoría exista en el índice
  let sec = sectionByName(line);
  if (!sec) { sec = { name: line, categories: [] }; taxonomy.sections.push(sec); }
  if (category && !sec.categories.includes(category)) sec.categories.push(category);

  dlg.close();
  setDirty(true);
  renderAll();
});
$("#cancelDlg").addEventListener("click", () => dlg.close());
$("#closeDlg").addEventListener("click", () => dlg.close());

/* ---------- secciones y categorías ---------- */
function renderTaxonomy() {
  const box = $("#sections");
  box.innerHTML = taxonomy.sections.map((s, i) => `
    <div class="seccard" data-i="${i}">
      <div class="sechead">
        <input data-secname value="${esc(s.name)}" maxlength="80" aria-label="Nombre de la sección">
        <span class="count">${countIn(s.name)} artículos</span>
        <div class="secbtns">
          <button class="btn sm" data-up type="button" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
          <button class="btn sm" data-down type="button" ${i === taxonomy.sections.length - 1 ? "disabled" : ""} aria-label="Bajar">↓</button>
          <button class="btn sm danger-o" data-delsec type="button">Eliminar sección</button>
        </div>
      </div>
      <div class="chips">
        ${s.categories.length ? s.categories.map((c, j) => `
          <span class="chip" data-j="${j}">
            <span>${esc(c)}</span><span class="n">${countIn(s.name, c)}</span>
            <button class="ed" data-ren type="button" title="Renombrar" aria-label="Renombrar ${esc(c)}">✎</button>
            <button data-delcat type="button" title="Eliminar" aria-label="Eliminar ${esc(c)}">×</button>
          </span>`).join("") : '<span class="muted">Sin categorías todavía.</span>'}
      </div>
      <form class="inline-add" data-addcat>
        <input placeholder="Nueva categoría" maxlength="80" aria-label="Nueva categoría">
        <button class="btn sm dark" type="submit">+ Agregar categoría</button>
      </form>
    </div>`).join("");
}

const secOf = (el) => taxonomy.sections[Number(el.closest(".seccard").dataset.i)];

$("#sections").addEventListener("change", (e) => {
  if (!e.target.matches("[data-secname]")) return;
  const s = secOf(e.target), old = s.name, name = e.target.value.trim();
  if (!name || name === old) { e.target.value = old; return; }
  if (taxonomy.sections.some((x) => x !== s && x.name.toLowerCase() === name.toLowerCase())) { alert("Ya existe una sección con ese nombre."); e.target.value = old; return; }
  s.name = name;
  products.forEach((p) => { if (p.line === old) p.line = name; });
  setDirty(true); renderAll();
});

$("#sections").addEventListener("click", (e) => {
  const card = e.target.closest(".seccard"); if (!card) return;
  const i = Number(card.dataset.i), s = taxonomy.sections[i];
  if (e.target.closest("[data-up]") && i > 0) { [taxonomy.sections[i - 1], taxonomy.sections[i]] = [s, taxonomy.sections[i - 1]]; }
  else if (e.target.closest("[data-down]") && i < taxonomy.sections.length - 1) { [taxonomy.sections[i + 1], taxonomy.sections[i]] = [s, taxonomy.sections[i + 1]]; }
  else if (e.target.closest("[data-delsec]")) {
    const n = countIn(s.name);
    if (n) return alert(`La sección "${s.name}" tiene ${n} artículos. Movelos a otra sección o eliminalos antes de borrarla.`);
    if (!confirm(`¿Eliminar la sección "${s.name}" y sus categorías?`)) return;
    taxonomy.sections.splice(i, 1);
  } else if (e.target.closest("[data-ren]")) {
    const j = Number(e.target.closest(".chip").dataset.j), old = s.categories[j];
    const name = (prompt("Nuevo nombre de la categoría:", old) || "").trim();
    if (!name || name === old) return;
    if (s.categories.some((c, k) => k !== j && c.toLowerCase() === name.toLowerCase())) return alert("Ya existe esa categoría en la sección.");
    s.categories[j] = name;
    products.forEach((p) => { if (p.line === s.name && p.category === old) p.category = name; });
  } else if (e.target.closest("[data-delcat]")) {
    const j = Number(e.target.closest(".chip").dataset.j), c = s.categories[j];
    const n = countIn(s.name, c);
    if (n) return alert(`La categoría "${c}" tiene ${n} artículos. Cambialos de categoría o eliminalos antes de borrarla.`);
    if (!confirm(`¿Eliminar la categoría "${c}"?`)) return;
    s.categories.splice(j, 1);
  } else return;
  setDirty(true); renderAll();
});

$("#sections").addEventListener("submit", (e) => {
  const f = e.target.closest("[data-addcat]"); if (!f) return;
  e.preventDefault();
  const s = secOf(f), input = f.querySelector("input"), name = input.value.trim();
  if (!name) return;
  if (s.categories.some((c) => c.toLowerCase() === name.toLowerCase())) return alert("Esa categoría ya existe en la sección.");
  s.categories.push(name);
  setDirty(true); renderAll();
});

$("#addSection").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#newSectionName").value.trim();
  if (!name) return;
  if (sectionByName(name)) return alert("Ya existe una sección con ese nombre.");
  taxonomy.sections.push({ name, categories: [] });
  $("#newSectionName").value = "";
  setDirty(true); renderAll();
});

/* ---------- importar planilla de precios ---------- */
$("#uploadPriceSheet").addEventListener("click", () => {
  if (dirty) return alert("Primero guardá o descartá los cambios pendientes antes de importar una planilla.");
  $("#priceSheetFile").click();
});

function normalizedHeader(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function parseImportPrice(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  let raw = String(value ?? "").trim().replace(/ARS/ig, "").replace(/\$/g, "").replace(/\s/g, "");
  if (!raw) return null;
  if (raw.includes(",") && raw.includes(".")) raw = raw.replace(/\./g, "").replace(",", ".");
  else if (raw.includes(",")) raw = /,\d{1,2}$/.test(raw) ? raw.replace(",", ".") : raw.replace(/,/g, "");
  else if ((raw.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(raw)) raw = raw.replace(/\./g, "");
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
function sheetColumns(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const headers = (rows[i] || []).map(normalizedHeader);
    const find = (...names) => headers.findIndex(h => names.includes(h));
    const code = find("codigo", "codigoproducto", "cod");
    const name = find("nombre", "producto", "articulo", "nombreproducto");
    const publishedPrice = find("preciopublicado", "preciopublicadoars", "precio");
    const referencePrice = find("preciodereferenciaestimado", "preciodereferenciaestimadoars", "precioreferencia", "precioreferenciaestimado");
    if (code >= 0 && name >= 0 && (publishedPrice >= 0 || referencePrice >= 0)) {
      return {
        headerRow: i, code, name,
        line: find("seccion", "linea", "seccionlinea"),
        category: find("categoria"),
        brand: find("marca"),
        description: find("descripcion"),
        publishedPrice, referencePrice
      };
    }
  }
  return null;
}
function sheetCell(row, index) {
  return index >= 0 ? String(row[index] ?? "").trim() : "";
}
async function importPriceWorkbook(file) {
  const status = $("#priceImportStatus");
  status.hidden = false;
  status.className = "import-status";
  status.textContent = "Leyendo la planilla…";
  try {
    if (file.size > 15 * 1024 * 1024) throw new Error("La planilla supera el límite de 15 MB.");
    if (!window.XLSX) throw new Error("No se pudo cargar el lector de Excel. Revisá tu conexión e intentá de nuevo.");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const preferred = workbook.SheetNames.find(n => normalizedHeader(n) === "catalogo");
    const sheetNames = preferred ? [preferred, ...workbook.SheetNames.filter(n => n !== preferred)] : workbook.SheetNames;
    let selected = null, columns = null;
    for (const name of sheetNames) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: "" });
      const found = sheetColumns(rows);
      if (found) { selected = rows; columns = found; break; }
    }
    if (!selected || !columns) throw new Error("No encontré encabezados compatibles. La hoja debe incluir Código, Nombre y Precio publicado o Precio de referencia estimado.");

    const incoming = [];
    const seen = new Set();
    for (const row of selected.slice(columns.headerRow + 1)) {
      const code = sheetCell(row, columns.code);
      if (!code) continue;
      const key = code.toLocaleLowerCase("es-AR");
      if (seen.has(key)) throw new Error("El código " + code + " aparece más de una vez en la planilla. Corregí los duplicados y volvé a subirla.");
      seen.add(key);
      const name = sheetCell(row, columns.name);
      const line = sheetCell(row, columns.line);
      if (!name || !line) throw new Error("El artículo " + code + " necesita Nombre y Sección para poder importarse.");
      const primary = columns.publishedPrice >= 0 ? parseImportPrice(row[columns.publishedPrice]) : null;
      const reference = columns.referencePrice >= 0 ? parseImportPrice(row[columns.referencePrice]) : null;
      incoming.push({
        code, name, line,
        category: sheetCell(row, columns.category),
        brand: sheetCell(row, columns.brand),
        description: sheetCell(row, columns.description),
        price: primary !== null ? primary : reference
      });
    }
    if (!incoming.length) throw new Error("La hoja no contiene artículos para importar.");

    const next = products.map(p => ({ ...p }));
    const byCode = new Map(next.map(p => [p.code.toLocaleLowerCase("es-AR"), p]));
    const ids = new Set(next.map(p => p.id));
    let updated = 0, added = 0;
    for (const item of incoming) {
      let product = byCode.get(item.code.toLocaleLowerCase("es-AR"));
      if (product) {
        product.code = item.code;
        product.name = item.name;
        product.line = item.line;
        if (item.category) product.category = item.category;
        if (item.brand) product.brand = item.brand;
        if (item.description) product.description = item.description;
        if (item.price !== null) product.price = item.price;
        updated++;
      } else {
        let id = slug(item.code), suffix = 2;
        while (ids.has(id)) id = slug(item.code) + "-" + suffix++;
        product = {
          id, code: item.code, name: item.name, line: item.line,
          category: item.category, brand: item.brand, description: item.description,
          image: "", visible: true, featured: false, price: item.price, pricePublished: false
        };
        next.push(product);
        ids.add(id);
        byCode.set(item.code.toLocaleLowerCase("es-AR"), product);
        added++;
      }
    }

    for (const product of next) {
      let section = sectionByName(product.line);
      if (!section) {
        section = { name: product.line, categories: [] };
        taxonomy.sections.push(section);
      }
      if (product.category && !section.categories.includes(product.category)) section.categories.push(product.category);
    }
    products = next;
    renderAll();
    setDirty(true, "Planilla aplicada; guardando artículos…");
    await saveAll();
    if ($("#savebar").classList.contains("error")) {
      status.className = "import-status error";
      status.textContent = "La planilla se leyó, pero los cambios no se guardaron. " + $("#status").textContent;
      return;
    }

    const importedCodes = new Set(incoming.map(item => item.code.toLocaleLowerCase("es-AR")));
    const missing = products.filter(p => p.visible !== false && !importedCodes.has(p.code.toLocaleLowerCase("es-AR")));
    const warning = missing.length
      ? " Advertencia: " + missing.length + " artículo(s) visible(s) no incluido(s) en la planilla (se conservaron): " + missing.slice(0, 18).map(p => p.code + " — " + p.name).join("; ") + (missing.length > 18 ? "; y " + (missing.length - 18) + " más." : ".")
      : " No quedaron artículos visibles fuera de la planilla.";
    status.className = missing.length ? "import-status warning" : "import-status success";
    status.textContent = "Importación completada: " + updated + " actualizado(s), " + added + " nuevo(s)." + warning;
  } catch (err) {
    status.className = "import-status error";
    status.textContent = "No se importó la planilla: " + err.message;
  }
}
$("#priceSheetFile").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (file) await importPriceWorkbook(file);
});

/* ---------- guardar ---------- */
$("#saveAll").addEventListener("click", saveAll);
async function saveAll() {
  const btn = $("#saveAll");
  btn.disabled = true;
  $("#status").textContent = "Guardando…";
  try {
    for (const p of products) {
      if (p._file) {
        const r = await api("image/" + encodeURIComponent(p.id), { method: "POST", raw: p._file, type: p._file.type || "image/webp" });
        p.image = r.url;
      } else if (p._clear) {
        await api("image/" + encodeURIComponent(p.id), { method: "DELETE" });
      }
    }
    await api("taxonomy", { method: "PUT", body: taxonomy });
    const clean = products.map(({ _file, _preview, _clear, ...rest }) => rest);
    const r = await api("products", { method: "PUT", body: { products: clean } });
    const d = await api("admin");
    products = d.products || []; taxonomy = d.taxonomy || taxonomy;
    renderAll();
    const t = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    setDirty(false, `Guardado a las ${t} · ${r.count} artículos`);
    $("#savebar").classList.add("ok");
  } catch (err) {
    $("#savebar").classList.add("error");
    $("#status").textContent = "No se pudo guardar: " + err.message;
  } finally { btn.disabled = false; }
}

/* ---------- inicio ---------- */
(async () => {
  try {
    const s = await api("session");
    if (s.authenticated) await openApp(); else showLogin();
  } catch { showLogin(); }
})();
