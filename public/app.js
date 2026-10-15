let WA_NUMBER = "5493435718032";
let PRICES = {5: 12000, 10: 18000};
let ALIAS = "rayo.doblar.rizo.mp";
let SITE_SETTINGS = {};
const CART_KEY = "decants_parana_cart_v3";
const CUSTOMER_KEY = "decants_parana_customer_v2";

let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
let customer = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "null");
const FAV_KEY = "decants_parana_favs_v1";
const TOKEN_KEY = "decants_parana_ctoken_v1";
function readLS(key, fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback}}
let favs = readLS(FAV_KEY, []); if(!Array.isArray(favs)) favs = [];
let customerToken = localStorage.getItem(TOKEN_KEY) || "";
let activeBrand = "all";
const PAGE_SIZE = 8;
let currentPage = 1;

const $ = (s) => document.querySelector(s);
const money = (n) => new Intl.NumberFormat("es-AR", {style:"currency", currency:"ARS", maximumFractionDigits:0}).format(n);

const pkey=(p)=>p.id||p.slug||slugify(p.name);
function slugify(s){return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function isRemote(u){return /^(https?:)?\/\//i.test(u||"")||String(u||"").startsWith("/api/");}
function productImage(p){
  const img = p.image || "";
  if (isRemote(img)) return img;                       // foto cargada desde el panel o desde una tienda
  return `assets/perfumes/${pkey(p)}.jpg`;             // foto real subida a la carpeta (tiene prioridad)
}
function imageFallback(p){
  const img = p.image || "";
  return (!img || isRemote(img)) ? "" : img;           // ilustración provisoria
}
function imgOnError(hideSelf){
  return `if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';return}${hideSelf}`;
}
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function initials(name){return name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();}
function saveCart(){localStorage.setItem(CART_KEY, JSON.stringify(cart));}
function totalQty(){return cart.reduce((a,i)=>a+i.qty,0);}
function totalPrice(){return cart.reduce((a,i)=>a+i.price*i.qty,0);}

// ---------- favoritos ----------
const HEART_SVG='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
const isFav=(id)=>favs.includes(id);
function favLabels(on){return on?{aria:"Quitar de favoritos",text:"En mis favoritos"}:{aria:"Agregar a favoritos",text:"Agregar a favoritos"}}
function favButton(id,cls="",withLabel=false){
  const on=isFav(id), l=favLabels(on);
  return `<button type="button" class="fav-btn ${cls} ${on?"active":""}" data-fav="${escapeHtml(id)}" aria-pressed="${on}" aria-label="${l.aria}" title="${l.aria}">${HEART_SVG}${withLabel?`<span class="fav-label">${l.text}</span>`:""}</button>`;
}
function saveFavs(){localStorage.setItem(FAV_KEY, JSON.stringify(favs));}
function favItems(){
  return favs.map(findProduct).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"es",{sensitivity:"base"}));
}
function renderFavPanel(){
  const items=favItems();
  $("#favItems").innerHTML = items.length
    ? `<ul class="fav-list">${items.map(p=>{
        const id=escapeHtml(pkey(p));
        return `<li class="fav-item">
          <a class="fav-link" href="#ficha/${encodeURIComponent(pkey(p))}" data-detail="${id}">
            <img class="fav-thumb" src="${escapeHtml(productImage(p))}" data-fb="${escapeHtml(imageFallback(p))}" alt="" loading="lazy" onerror="${imgOnError("this.style.visibility='hidden'")}">
            <span class="fav-name"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.brand)}</small></span>
          </a>
          <button type="button" class="fav-remove" data-fav="${id}" aria-label="Quitar ${escapeHtml(p.name)} de favoritos" title="Quitar de favoritos">×</button>
        </li>`}).join("")}</ul>`
    : `<p class="fav-empty">Todavía no tenés favoritos. Tocá el ♥ en cualquier perfume para guardarlo acá.</p>`;
  $("#favNote").innerHTML = customerToken
    ? "Tus favoritos están guardados en tu cuenta."
    : `Para guardarlos en tu cuenta, completá <a href="#registro" data-close="favs">tus datos</a>.`;
}
function updateFavUI(){
  $("#favCount").textContent=favItems().length;
  document.querySelectorAll(".fav-btn").forEach(b=>{
    const on=isFav(b.dataset.fav), l=favLabels(on);
    b.classList.toggle("active",on);
    b.setAttribute("aria-pressed",on);
    b.setAttribute("aria-label",l.aria);
    b.title=l.aria;
    const t=b.querySelector(".fav-label"); if(t) t.textContent=l.text;
  });
  renderFavPanel();
}
function openFavPanel(){const p=$("#favPanel");p.classList.add("open");p.setAttribute("aria-hidden","false");$("#favBtn").setAttribute("aria-expanded","true");renderFavPanel();}
function closeFavPanel(){const p=$("#favPanel");p.classList.remove("open");p.setAttribute("aria-hidden","true");$("#favBtn").setAttribute("aria-expanded","false");}
function toggleFav(id){
  const p=findProduct(id);
  const adding=!isFav(id);
  favs=adding?[...favs,id]:favs.filter(x=>x!==id);
  saveFavs(); updateFavUI();
  const name=p?p.name:"Perfume";
  showToast(adding?`♥ ${name} agregado a favoritos${customerToken?"":" · completá tus datos para guardarlos en tu cuenta"}`:`${name} quitado de favoritos`);
  if(customerToken) favRemote(adding?"add":"remove",id);
}
function unlinkAccount(){customerToken="";localStorage.removeItem(TOKEN_KEY);}
const authHeaders=()=>({"content-type":"application/json",...(customerToken?{"x-customer-token":customerToken}:{})});
async function favRemote(action,id){
  try{
    const r=await fetch("/api/favorites",{method:"POST",headers:authHeaders(),body:JSON.stringify({action,id})});
    if(r.status===401){unlinkAccount();updateFavUI();return}
    if(!r.ok)throw new Error("sync");
  }catch{showToast("No se pudo sincronizar tus favoritos con tu cuenta")}
}
async function syncFavsFromServer(){
  if(!customerToken)return;
  try{
    const r=await fetch("/api/favorites",{headers:authHeaders(),cache:"no-store"});
    if(r.status===401){unlinkAccount();updateFavUI();return}
    if(!r.ok)return;
    const d=await r.json();
    if(Array.isArray(d.favorites)){favs=d.favorites;saveFavs();updateFavUI();}
  }catch{/* sin conexión: quedan los favoritos locales */}
}
// Crea o actualiza la cuenta del cliente y le vincula los favoritos
async function linkAccount(c){
  try{
    const r=await fetch("/api/customer",{method:"POST",headers:authHeaders(),body:JSON.stringify({...c,favorites:favs})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)return {ok:false,error:d.error||"No se pudo vincular tu cuenta."};
    customerToken=d.token;localStorage.setItem(TOKEN_KEY,d.token);
    if(Array.isArray(d.favorites)){favs=d.favorites;saveFavs();}
    updateFavUI();
    return {ok:true,existing:!!d.existing};
  }catch{return {ok:false,error:"Sin conexión con el servidor."}}
}
function openFromHash(){
  const m=location.hash.match(/^#ficha\/(.+)$/);
  if(!m)return;
  let id=m[1]; try{id=decodeURIComponent(id)}catch{}
  if(findProduct(id))showProduct(id);
}

const VIAL_SVG='<svg class="vial" viewBox="0 0 85 224" aria-hidden="true" focusable="false"><rect x="9" y="1" width="68" height="46" rx="10" fill="currentColor"/><rect x="2" y="48" width="82" height="27" rx="4" fill="currentColor"/><rect x="39.8" y="74" width="5.6" height="132" fill="currentColor"/><rect x="5.3" y="84.3" width="74.4" height="135.4" rx="12" fill="#fff" stroke="currentColor" stroke-width="6.6"/><rect x="39.8" y="86" width="5.6" height="120" fill="currentColor"/><rect x="18.5" y="108" width="48" height="78" rx="6" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="9 6"/></svg>';
function productCard(p){
  const desc = p.description || "Ficha olfativa pendiente de verificación en la fuente del proveedor.";
  const _id=escapeHtml(pkey(p));
  return `<article class="product-card">
    <div class="product-image is-link" data-detail="${_id}" role="button" tabindex="0" aria-label="Ver ficha de ${escapeHtml(p.name)}">
      <img src="${escapeHtml(productImage(p))}" data-fb="${escapeHtml(imageFallback(p))}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="${imgOnError("this.style.display='none';this.nextElementSibling.style.display='block'")}">
      <span class="image-fallback" style="display:none">${escapeHtml(initials(p.name))}</span>
      <span class="brand-badge">${escapeHtml(p.brand)}</span>
      ${favButton(pkey(p),"card-fav")}
    </div>
    <div class="product-body">
      <h3 class="is-link" data-detail="${_id}" role="button" tabindex="0">${escapeHtml(p.name)}</h3>
      <p class="is-link product-desc" data-detail="${_id}" role="button" tabindex="0">${escapeHtml(desc)}</p>
      
      <div class="product-actions">
        ${p.enabled5 !== false ? `<button class="size-btn" data-add="${escapeHtml(pkey(p))}" data-size="5" aria-label="Agregar 5 ml, ${money(p.price5 ?? PRICES[5])}">${VIAL_SVG}<span class="sz">5 ml</span><span class="pr">${money(p.price5 ?? PRICES[5])}</span></button>` : ""}
        ${p.enabled10 !== false ? `<button class="size-btn" data-add="${escapeHtml(pkey(p))}" data-size="10" aria-label="Agregar 10 ml, ${money(p.price10 ?? PRICES[10])}">${VIAL_SVG}<span class="sz">10 ml</span><span class="pr">${money(p.price10 ?? PRICES[10])}</span></button>` : ""}
      </div>
      <button type="button" class="detail-btn" data-detail="${escapeHtml(pkey(p))}">Ver ficha</button>
    </div>
  </article>`;
}
function filteredProducts(){
  const q = $("#searchInput").value.trim().toLowerCase();
  let list = PRODUCTS.filter(p => (activeBrand==="all" || p.brand===activeBrand) && (!q || `${p.name} ${p.brand}`.toLowerCase().includes(q)));
  list.sort((a,b) => {
    const dir = $("#sortSelect").value === "za" ? -1 : 1;
    return dir * a.name.localeCompare(b.name, "es", {sensitivity:"base"});
  });
  return list;
}
function renderCatalog(){
  const list = filteredProducts();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (currentPage > pages) currentPage = pages;
  if (currentPage < 1) currentPage = 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = list.slice(start, start + PAGE_SIZE);
  $("#productGrid").innerHTML = slice.length ? slice.map(productCard).join("") : `<div class="no-results">No encontramos perfumes con esa búsqueda.</div>`;
  $("#resultCount").textContent = list.length
    ? `${list.length} perfume${list.length===1?"":"s"} · mostrando ${start+1}–${start+slice.length}`
    : "0 perfumes";
  renderPagination(pages);
  renderChips();
}
function pageNumbers(total, cur){
  if (total <= 7) return Array.from({length: total}, (_, i) => i + 1);
  const set = new Set([1, total, cur - 1, cur, cur + 1]);
  if (cur <= 3) [2, 3, 4].forEach(n => set.add(n));
  if (cur >= total - 2) [total - 3, total - 2, total - 1].forEach(n => set.add(n));
  const nums = [...set].filter(n => n >= 1 && n <= total).sort((x, y) => x - y);
  const out = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push("…"); out.push(n); });
  return out;
}
function renderPagination(pages){
  const box = $("#pagination");
  if (pages <= 1) { box.innerHTML = ""; return; }
  const btn = (label, page, extra = "", disabled = false) => `<button type="button" class="page-btn ${extra}" data-page="${page}" ${disabled ? "disabled" : ""} ${extra.includes("active") ? 'aria-current="page"' : ""}>${label}</button>`;
  box.innerHTML = btn('←<span class="page-lbl"> Anterior</span>', currentPage - 1, "page-nav", currentPage === 1)
  + pageNumbers(pages, currentPage).map(n => n === "…" ? `<span class="page-gap">…</span>` : btn(n, n, n === currentPage ? "active" : "")).join("")
  + btn('<span class="page-lbl">Siguiente </span>→', currentPage + 1, "page-nav", currentPage === pages);
}
function goToPage(n){
  currentPage = n;
  renderCatalog();
  const top = $("#catalogo").getBoundingClientRect().top + window.scrollY - 84;
  window.scrollTo({ top, behavior: "smooth" });
}
function renderChips(){
  const brands = [...new Set(PRODUCTS.map(p=>p.brand))].sort((a,b)=>a.localeCompare(b,"es"));
  $("#brandFilter").innerHTML = `<option value="all">Todas las marcas</option>` + brands.map(b=>`<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  $("#brandFilter").value = activeBrand;
  $("#brandChips").innerHTML = `<button class="chip ${activeBrand==="all"?"active":""}" data-brand="all">Todas</button>` + brands.map(b=>`<button class="chip ${activeBrand===b?"active":""}" data-brand="${escapeHtml(b)}">${escapeHtml(b)}</button>`).join("");
}
function findProduct(slug){return PRODUCTS.find(p=>pkey(p)===slug);}
function addToCart(slug,size){
  const p=findProduct(slug); if(!p)return;
  const key=`${slug}|${size}`;
  const existing=cart.find(i=>i.key===key);
  if(existing) existing.qty++;
  else cart.push({key,slug,size,price:(size===5 ? (p.price5 ?? PRICES[5]) : (p.price10 ?? PRICES[10])),qty:1});
  saveCart(); updateCartUI(); showToast(`${p.name} · ${size} ml agregado`);
}
function updateQty(key,delta){
  const i=cart.find(x=>x.key===key); if(!i)return;
  i.qty+=delta;
  if(i.qty<=0) cart=cart.filter(x=>x.key!==key);
  saveCart(); updateCartUI();
}
function removeItem(key){cart=cart.filter(x=>x.key!==key);saveCart();updateCartUI();}
function renderCart(){
  const box=$("#cartItems");
  if(!cart.length){box.innerHTML=`<div class="cart-empty"><p>Tu carrito está vacío.</p><a href="#catalogo" class="btn btn-light" data-close="cart">Ver perfumes</a></div>`;$("#cartTotal").textContent=money(0);return;}
  box.innerHTML=cart.map(i=>{
    const p=findProduct(i.slug); if(!p)return "";
    return `<div class="cart-line">
      <img class="cart-thumb" src="${escapeHtml(productImage(p))}" data-fb="${escapeHtml(imageFallback(p))}" alt="" onerror="${imgOnError("this.style.visibility='hidden'")}">
      <div><h4>${escapeHtml(p.name)}</h4><p>${escapeHtml(p.brand)} · ${i.size} ml · ${money(i.price)}</p>
        <div class="qty"><button data-qty="${escapeHtml(i.key)}" data-delta="-1">−</button><span>${i.qty}</span><button data-qty="${escapeHtml(i.key)}" data-delta="1">+</button></div>
        <button class="remove" data-remove="${escapeHtml(i.key)}">Eliminar</button>
      </div>
      <div class="line-total">${money(i.price*i.qty)}</div>
    </div>`;
  }).join("");
  $("#cartTotal").textContent=money(totalPrice());
}
function updateCartUI(){
  const q=totalQty();
  $("#cartCount").textContent=q;
  $("#heroCartCount").textContent=`(${q})`;
  renderCart();
}
function openDrawer(){ $("#cartDrawer").classList.add("open"); $("#cartDrawer").setAttribute("aria-hidden","false"); renderCart(); }
function closeDrawer(){ $("#cartDrawer").classList.remove("open"); $("#cartDrawer").setAttribute("aria-hidden","true"); }
function openModal(id){const el=$(id);el.classList.add("open");el.setAttribute("aria-hidden","false");}
function closeModal(id){const el=$(id);el.classList.remove("open");el.setAttribute("aria-hidden","true");}
function showProduct(slug){
  const p=findProduct(slug);if(!p)return;
  const desc=p.description || "Ficha olfativa pendiente de verificación en la fuente del proveedor.";
  $("#modalBody").innerHTML=`<div class="modal-product-grid">
    <div class="modal-product-image"><img src="${escapeHtml(productImage(p))}" data-fb="${escapeHtml(imageFallback(p))}" alt="${escapeHtml(p.name)}" onerror="${imgOnError("this.style.display='none'")}"></div>
    <div><p class="eyebrow">${escapeHtml(p.brand)}</p><h2 id="modalTitle">${escapeHtml(p.name)}</h2>${favButton(pkey(p),"modal-fav",true)}<p class="description">${escapeHtml(desc)}</p>
      <div class="modal-sizes">${p.enabled5 !== false ? `<button class="size-btn" data-add="${escapeHtml(pkey(p))}" data-size="5" aria-label="Agregar 5 ml, ${money(p.price5 ?? PRICES[5])}">${VIAL_SVG}<span class="sz">5 ml</span><span class="pr">${money(p.price5 ?? PRICES[5])}</span></button>` : ""}${p.enabled10 !== false ? `<button class="size-btn" data-add="${escapeHtml(pkey(p))}" data-size="10" aria-label="Agregar 10 ml, ${money(p.price10 ?? PRICES[10])}">${VIAL_SVG}<span class="sz">10 ml</span><span class="pr">${money(p.price10 ?? PRICES[10])}</span></button>` : ""}</div>
      </div></div>`;
  openModal("#productModal");
}
function fillCustomerForm(){
  if(!customer)return;
  ["nombre","apellido","domicilio","localidad","telefono","email"].forEach(k=>{const el=$(`#customerForm [name="${k}"]`);if(el)el.value=customer[k]||""});
}
function fillCheckout(){
  const fields={coNombre:"nombre",coApellido:"apellido",coDomicilio:"domicilio",coLocalidad:"localidad",coTelefono:"telefono"};
  Object.entries(fields).forEach(([id,key])=>{const el=$("#"+id);if(el)el.value=customer?.[key]||$("#customerForm [name='"+key+"']")?.value||""});
}
function pruneCart(){const n=cart.length;cart=cart.filter(i=>findProduct(i.slug));if(cart.length!==n)saveCart()}
function checkoutSummary(){
  $("#checkoutSummary").innerHTML=`<div class="checkout-summary">${cart.map(i=>{const p=findProduct(i.slug);return `<div class="checkout-summary-row"><span>${escapeHtml(p.name)} · ${i.size} ml × ${i.qty}</span><strong>${money(i.price*i.qty)}</strong></div>`}).join("")}<div class="checkout-summary-row checkout-total"><span>Total</span><strong>${money(totalPrice())}</strong></div></div>`;
}
function openCheckout(){
  pruneCart();
  if(!cart.length){showToast("Agregá al menos un perfume al carrito");return;}
  closeDrawer();fillCheckout();checkoutSummary();openModal("#checkoutModal");
}
function buildWhatsApp(){
  const f={nombre:$("#coNombre").value.trim(),apellido:$("#coApellido").value.trim(),domicilio:$("#coDomicilio").value.trim(),localidad:$("#coLocalidad").value.trim(),telefono:$("#coTelefono").value.trim()};
  const lines=["Hola DECANTS PARANA, quiero realizar este pedido:","","*DETALLE*"];
  cart.forEach(i=>{const p=findProduct(i.slug);lines.push(`• ${p.name} — ${i.size} ml × ${i.qty} = ${money(i.price*i.qty)}`)});
  lines.push("",`*TOTAL: ${money(totalPrice())}*`,"","*DATOS DEL CLIENTE*",`${f.nombre} ${f.apellido}`,`Domicilio: ${f.domicilio}`,`Localidad: ${f.localidad}`,`Teléfono: ${f.telefono}`,"",`Pago: transferencia Mercado Pago`,`Alias: ${ALIAS}`,"","Ya realicé / realizaré la transferencia. Quedo a la espera de la confirmación de disponibilidad.");
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}
function showToast(msg){let t=$("#toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t)}t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2200)}

document.addEventListener("click",e=>{
  if(!e.target.closest("#favPanel,#favBtn"))closeFavPanel();
  const add=e.target.closest("[data-add]");if(add){addToCart(add.dataset.add,Number(add.dataset.size));return}
  const fav=e.target.closest("[data-fav]");if(fav){e.preventDefault();toggleFav(fav.dataset.fav);return}
  const detail=e.target.closest("[data-detail]");if(detail){e.preventDefault();closeFavPanel();showProduct(detail.dataset.detail);return}
  const pg=e.target.closest("[data-page]");if(pg){if(!pg.disabled)goToPage(Number(pg.dataset.page));return}
  const brand=e.target.closest("[data-brand]");if(brand){activeBrand=brand.dataset.brand;currentPage=1;$("#brandFilter").value=activeBrand;renderCatalog();return}
  const qty=e.target.closest("[data-qty]");if(qty){updateQty(qty.dataset.qty,Number(qty.dataset.delta));return}
  const rem=e.target.closest("[data-remove]");if(rem){removeItem(rem.dataset.remove);return}
  const close=e.target.closest("[data-close]");if(close){if(close.dataset.close==="favs")closeFavPanel();if(close.dataset.close==="cart")closeDrawer();if(close.dataset.close==="modal")closeModal("#productModal");if(close.dataset.close==="checkout")closeModal("#checkoutModal");return}
});
$("#searchInput").addEventListener("input",()=>{currentPage=1;renderCatalog()});
$("#sortSelect").addEventListener("change",()=>{currentPage=1;renderCatalog()});
$("#brandFilter").addEventListener("change",e=>{activeBrand=e.target.value;currentPage=1;renderCatalog()});
$("#cartBtn").addEventListener("click",()=>{closeFavPanel();openDrawer()});
$("#favBtn").addEventListener("click",()=>{$("#favPanel").classList.contains("open")?closeFavPanel():openFavPanel()});
$("#heroCartBtn").addEventListener("click",openDrawer);
$("#checkoutBtn").addEventListener("click",openCheckout);
$("#clearCartBtn").addEventListener("click",()=>{cart=[];saveCart();updateCartUI();showToast("Carrito vaciado")});
$("#customerForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const form=e.currentTarget, msg=$("#saveMessage"), btn=form.querySelector("[type=submit]");
  customer=Object.fromEntries(new FormData(form).entries());
  localStorage.setItem(CUSTOMER_KEY,JSON.stringify(customer));
  btn.disabled=true; msg.textContent="Guardando…";
  const res=await linkAccount(customer);
  btn.disabled=false;
  if(res.ok){
    msg.textContent=res.existing
      ? "Encontramos tu cuenta con ese teléfono: recuperamos tus favoritos."
      : "Datos guardados. Tus favoritos quedaron vinculados a tu cuenta.";
    showToast("Datos guardados");
  }else{
    msg.textContent=`Datos guardados en este dispositivo, pero no se vincularon a tu cuenta: ${res.error}`;
  }
});
$("#checkoutForm").addEventListener("submit",e=>{
  e.preventDefault();
  customer={...customer,nombre:$("#coNombre").value.trim(),apellido:$("#coApellido").value.trim(),domicilio:$("#coDomicilio").value.trim(),localidad:$("#coLocalidad").value.trim(),telefono:$("#coTelefono").value.trim()};
  localStorage.setItem(CUSTOMER_KEY,JSON.stringify(customer));
  if(customerToken)linkAccount(customer);
  window.open(buildWhatsApp(),"_blank","noopener");
});
document.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches(".is-link[data-detail]")){e.preventDefault();showProduct(e.target.dataset.detail);return}
  if(e.key==="Escape"){closeFavPanel();closeDrawer();closeModal("#productModal");closeModal("#checkoutModal")}});
async function loadCatalog(){
  try{
    const r=await fetch("/api/catalog",{cache:"no-store"});
    if(!r.ok) throw new Error("No se pudo cargar el catálogo");
    const data=await r.json();
    PRODUCTS.splice(0, PRODUCTS.length, ...(data.products||[]));
    SITE_SETTINGS=data.settings||{};
    WA_NUMBER=SITE_SETTINGS.whatsapp||WA_NUMBER;
    ALIAS=SITE_SETTINGS.alias||ALIAS;
    PRICES={5:Number(SITE_SETTINGS.price5)||12000,10:Number(SITE_SETTINGS.price10)||18000};
    applySiteSettings();
    renderCatalog(); fillCustomerForm(); updateCartUI(); updateFavUI();
    openFromHash(); syncFavsFromServer();
  }catch(err){
    // Fallback: the static seed remains usable if the backend is temporarily unavailable.
    renderCatalog(); fillCustomerForm(); updateCartUI(); updateFavUI(); openFromHash();
    showToast("Catálogo local cargado. Backend no disponible.");
  }
}
function applySiteSettings(){
  const s=SITE_SETTINGS;
  document.documentElement.style.setProperty("--primary",s.primaryColor||"");
  document.documentElement.style.setProperty("--accent",s.accentColor||"");
  document.documentElement.style.setProperty("--site-bg",s.backgroundColor||"");
  document.documentElement.style.setProperty("--card-bg",s.cardColor||"");
  document.documentElement.style.setProperty("--text",s.textColor||"");
  document.documentElement.style.setProperty("--muted",s.mutedColor||"");
  document.documentElement.style.setProperty("--font-family",s.fontFamily||"");
  const map={
    "[data-setting='siteName']":s.siteName,
    "[data-setting='heroEyebrow']":s.heroEyebrow,
    "[data-setting='heroTitle']":s.heroTitle,
    "[data-setting='heroTitleAccent']":s.heroTitleAccent,
    "[data-setting='heroText']":s.heroText,
    "[data-setting='catalogEyebrow']":s.catalogEyebrow,
    "[data-setting='catalogTitle']":s.catalogTitle,
    "[data-setting='howEyebrow']":s.howEyebrow,
    "[data-setting='howTitle']":s.howTitle,
    "[data-setting='contactTitle']":s.contactTitle,
    "[data-setting='contactText']":s.contactText,
    "[data-setting='footerText']":s.footerText
  };
  Object.entries(map).forEach(([sel,val])=>document.querySelectorAll(sel).forEach(el=>{if(val!=null)el.textContent=val;}));
  const wa=document.querySelector("[data-setting='whatsappLink']"); if(wa){wa.href=`https://wa.me/${WA_NUMBER}`;wa.textContent=`WhatsApp · +54 9 3435 71-8032`;}
  const email=document.querySelector("[data-setting='emailLink']"); if(email){email.href=`mailto:${s.email||""}`;email.textContent=s.email||"";}
  const alias=document.querySelector("[data-setting='alias']"); if(alias)alias.textContent=ALIAS;
  document.title=s.siteName||document.title;
}
window.addEventListener("hashchange",openFromHash);
const backBtn=$("#backToTop");
function toggleBackToTop(){backBtn.classList.toggle("show",window.scrollY>600)}
window.addEventListener("scroll",toggleBackToTop,{passive:true});
backBtn.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
toggleBackToTop();
loadCatalog();
