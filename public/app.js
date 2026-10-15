
const $ = s => document.querySelector(s);

const LINE_NAMES = [
  "Industrial",
  "Hogar",
  "Exterior y Tiempo Libre",
  "Tecnología",
  "Herramientas y Mantenimiento"
];

let all = [],
    cart = [],
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
  } catch {
    let r = await fetch("/seed-products.json");
    all = await r.json();
  }

  renderLines();
  populate();
  render();
}

const LINE_DESC = {
  "Industrial": "Gestión y venta · Cocción · Elaboración y procesamiento · Frío y exhibición · Mobiliario e infraestructura · Envasado",
  "Hogar": "Cocina · Frío · Lavado · Pequeños electrodomésticos · Climatización · Audio y video · Muebles · Descanso",
  "Exterior y Tiempo Libre": "Movilidad · Jardín y parque · Limpieza",
  "Tecnología": "Consolas · Informática · Telefonía",
  "Herramientas y Mantenimiento": "Herramientas eléctricas · Aire comprimido"
};

function renderLines() {
  $("#lineButtons").innerHTML = LINE_NAMES.map(l => `
    <button type="button" class="linebtn" data-line="${esc(l)}">
      <span class="linebtn-count">${all.filter(p => p.line === l).length} EQUIPOS</span>
      <span class="linebtn-title">${esc(l)}</span>
      <span class="linebtn-desc">${esc(LINE_DESC[l] || "")}</span>
    </button>
  `).join("");

  $("#lineButtons").querySelectorAll("button").forEach(b => {
    b.onclick = () => {
      $("#lineFilter").value = b.dataset.line;
      render();
      $("#catalogo").scrollIntoView();
    };
  });
}

function populate() {
  const opts = (id, values, label) => {
    $(id).innerHTML = `<option value="">${label}</option>` +
      [...new Set(values.filter(Boolean))]
        .sort()
        .map(v => `<option>${esc(v)}</option>`)
        .join("");
  };

  opts("#lineFilter", all.map(p => p.line), "Todas las líneas");
  opts("#categoryFilter", all.map(p => p.category), "Todas las categorías");
  opts("#brandFilter", all.map(p => p.brand), "Todas las marcas");
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

  $("#products").innerHTML = list.map(p => `
    <article class="product">

      <!-- CÓDIGO Y CATEGORÍA: AHORA ANTES DE LA FOTO -->
      <p class="code">${esc(p.code)} · ${esc(p.category)}</p>

      <div class="photo">
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

      <h3>${esc(p.name)}</h3>
      <p class="meta">${esc(p.brand)}</p>
      <p class="desc">${esc(p.description || "Consultanos por especificaciones, precio y disponibilidad.")}</p>

      <div class="actions">
        <button class="consult" data-add="${esc(p.id)}">CONSULTAR</button>
        <button data-add="${esc(p.id)}">+ CONSULTA</button>
      </div>

    </article>
  `).join("");

  $("#products").querySelectorAll("[data-fav]").forEach(b => {
    b.onclick = () => {
      let id = b.dataset.fav;

      favs = favs.includes(id)
        ? favs.filter(x => x !== id)
        : [...favs, id];

      localStorage.setItem("murador_favs", JSON.stringify(favs));
      render();
    };
  });

  $("#products").querySelectorAll("[data-add]").forEach(b => {
    b.onclick = () => {
      let p = all.find(x => x.id === b.dataset.add);

      if (!p) return;

      if (!cart.some(x => x.id === p.id)) cart.push(p);

      cartCount();

      if (b.classList.contains("consult")) {
        window.open(
          "https://wa.me/" + wa + "?text=" +
          encodeURIComponent("Hola Murador, quisiera consultar por " + p.code + " — " + p.name),
          "_blank"
        );
      }
    };
  });
}

function cartCount() {
  $("#cartCount").textContent = cart.length;

  $("#cartItems").innerHTML = cart.length
    ? cart.map(p => `
        <div class="cartrow">
          <span><b>${esc(p.code)}</b> — ${esc(p.name)}</span>
          <button data-remove="${esc(p.id)}">Quitar</button>
        </div>
      `).join("")
    : "Todavía no agregaste productos.";

  $("#cartItems").querySelectorAll("[data-remove]").forEach(b => {
    b.onclick = () => {
      cart = cart.filter(p => p.id !== b.dataset.remove);
      cartCount();
    };
  });
}

["#search", "#lineFilter", "#categoryFilter", "#brandFilter"].forEach(s => {
  $(s).addEventListener(
    s === "#search" ? "input" : "change",
    render
  );
});

$("#cartOpen").onclick = () => {
  $("#cartPanel").hidden = false;
  cartCount();
};

$("#cartClose").onclick = () => {
  $("#cartPanel").hidden = true;
};

$("#cartPanel").onclick = e => {
  if (e.target.id === "cartPanel") {
    $("#cartPanel").hidden = true;
  }
};

$("#sendCart").onclick = () => {
  if (!cart.length) return alert("Agregá al menos un producto.");

  let msg = "Hola Murador, quisiera consultar precio, disponibilidad y financiación de:\n" +
    cart.map(p => p.code + " — " + p.name).join("\n");

  window.open(
    "https://wa.me/" + wa + "?text=" + encodeURIComponent(msg),
    "_blank"
  );
};

load();
