// Should I evolve it? — static decision tool (GitHub Pages).
// Loads data/pokemon.json (built from the course pokemon.csv) and compares a
// Pokémon with each species it can evolve into.

const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const STATS = [
  ["hp", "HP"], ["attack", "Attack"], ["defense", "Defense"],
  ["special_attack", "Sp. Atk"], ["special_defense", "Sp. Def"], ["speed", "Speed"],
];
const PROFILES = {
  balanced: { label: "All-rounder", hint: "Every stat counts the same",
    w: { hp: 1, attack: 1, defense: 1, special_attack: 1, special_defense: 1, speed: 1 } },
  physical: { label: "Physical attacker", hint: "Attack and Speed first",
    w: { hp: 1, attack: 3, defense: 1, special_attack: 0, special_defense: 1, speed: 2 } },
  special: { label: "Special attacker", hint: "Sp. Atk and Speed first",
    w: { hp: 1, attack: 0, defense: 1, special_attack: 3, special_defense: 1, speed: 2 } },
  tank: { label: "Tank", hint: "HP and defences first",
    w: { hp: 2, attack: 0.5, defense: 2, special_attack: 0.5, special_defense: 2, speed: 0 } },
  fast: { label: "Fast striker", hint: "Speed above all",
    w: { hp: 0.5, attack: 1.5, defense: 0.5, special_attack: 1.5, special_defense: 0.5, speed: 3 } },
};
const TYPE_COLORS = {
  normal: "#A8A878", fire: "#F08030", water: "#6890F0", electric: "#F8D030", grass: "#78C850",
  ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0", ground: "#E0C068", flying: "#A890F0",
  psychic: "#F85888", bug: "#A8B820", rock: "#B8A038", ghost: "#705898", dragon: "#7038F8",
  dark: "#705848", steel: "#B8B8D0", fairy: "#EE99AC",
};

const $ = (s) => document.querySelector(s);
const state = { all: [], byId: new Map(), bySpecies: new Map(), byName: new Map(),
  current: null, selectedEvo: null, prefs: loadPrefs() };

// ------------------------------------------------------------------ helpers
function loadPrefs() {
  const def = { profile: "balanced", keepType: false, keepAbility: false, keepSmall: false };
  try { return { ...def, ...JSON.parse(localStorage.getItem("evolve-prefs") || "{}") }; }
  catch { return def; }
}
function savePrefs() {
  try { localStorage.setItem("evolve-prefs", JSON.stringify(state.prefs)); } catch { /* private mode */ }
}
const pretty = (n) => n.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const sprite = (p) => (p.img ? SPRITE_BASE + p.img : null);
const total = (s) => STATS.reduce((a, [k]) => a + s[k], 0);
const weighted = (s, w) => STATS.reduce((a, [k]) => a + s[k] * w[k], 0);
const fmtH = (dm) => `${(dm / 10).toFixed(1)} m`;
const fmtW = (hg) => `${(hg / 10).toFixed(1)} kg`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function typeChips(types) {
  return `<div class="types">${types.map((t) =>
    `<span class="type" style="background:${TYPE_COLORS[t] || "#888"}">${pretty(t)}</span>`).join("")}</div>`;
}
function spriteTag(p, cls = "sprite", size) {
  const url = sprite(p);
  if (!url) return `<div class="noimg">No image in the dataset for this entry</div>`;
  const dim = size ? ` width="${size}" height="${size}"` : "";
  return `<img class="${cls}" src="${url}" alt="${esc(pretty(p.name))}"${dim} loading="lazy">`;
}

// ------------------------------------------------------------------ decision logic
function evaluate(cur, evo, prefs) {
  const w = PROFILES[prefs.profile].w;
  const before = weighted(cur.stats, w);
  const after = weighted(evo.stats, w);
  const score = before > 0 ? ((after - before) / before) * 100 : 0;
  const reasons = [];
  const blockers = [];

  const bst = total(evo.stats) - total(cur.stats);
  reasons.push(bst === 0
    ? `Base stat total is unchanged (${total(cur.stats)}); the points are redistributed.`
    : `Base stat total ${bst > 0 ? "rises" : "falls"} by ${Math.abs(bst)} (${total(cur.stats)} → ${total(evo.stats)}).`);
  const diffs = STATS.map(([k, label]) => ({ k, label, d: evo.stats[k] - cur.stats[k], w: w[k] }));
  const losses = diffs.filter((x) => x.d < 0);
  const bestGain = diffs.filter((x) => x.w > 0).sort((a, b) => b.d * b.w - a.d * a.w)[0];
  if (bestGain && bestGain.d > 0) reasons.push(`Biggest gain for your priorities: ${bestGain.label} +${bestGain.d}.`);
  if (losses.length) {
    const important = losses.filter((x) => x.w >= 1.5);
    const txt = losses.map((x) => `${x.label} ${x.d}`).join(", ");
    reasons.push(important.length
      ? `Watch out: it loses ${txt}, and ${important.map((x) => x.label).join(" and ")} matters to you.`
      : `It loses ${txt}.`);
  }

  const lostTypes = cur.types.filter((t) => !evo.types.includes(t));
  const newTypes = evo.types.filter((t) => !cur.types.includes(t));
  if (lostTypes.length || newTypes.length) {
    const parts = [];
    if (newTypes.length) parts.push(`gains ${newTypes.map(pretty).join(" and ")}`);
    if (lostTypes.length) parts.push(`loses ${lostTypes.map(pretty).join(" and ")}`);
    const t = `Typing changes: it ${parts.join(" and ")}.`;
    if (prefs.keepType) blockers.push(t); else reasons.push(t);
  }

  const curAb = [...cur.abilities, cur.hidden].filter(Boolean);
  const evoAb = [...evo.abilities, evo.hidden].filter(Boolean);
  const lostAb = curAb.filter((a) => !evoAb.includes(a));
  if (lostAb.length) {
    const t = `It can no longer have ${lostAb.map(pretty).join(", ")}.`;
    if (prefs.keepAbility) blockers.push(t); else reasons.push(t);
  }

  if (evo.height > cur.height) {
    const t = `It grows from ${fmtH(cur.height)} to ${fmtH(evo.height)}.`;
    if (prefs.keepSmall) blockers.push(t); else if (evo.height >= cur.height * 2) reasons.push(t);
  }

  let cls, word;
  if (blockers.length) { cls = "stop"; word = "Keep it as it is"; }
  else if (score >= 15) { cls = "go"; word = "Evolve it"; }
  else if (score >= 3) { cls = "mild"; word = "Evolve, small upgrade"; }
  else if (score > -3) { cls = "even"; word = "It's a toss-up"; }
  else { cls = "stop"; word = "Keep it as it is"; }
  return { score, cls, word, reasons, blockers };
}

// ------------------------------------------------------------------ rendering
function render(p) {
  state.current = p;
  $("#empty").hidden = true;
  $("#result").hidden = false;
  document.title = `Should I evolve ${pretty(p.name)}?`;
  const c = p.colors[0] || TYPE_COLORS[p.types[0]] || "#6890f0";
  document.documentElement.style.setProperty("--accent", c);
  document.documentElement.style.setProperty("--accent-2", `color-mix(in srgb, ${c} 45%, #ffffff)`);

  $("#current").style.setProperty("--tc", c);
  $("#current").innerHTML = `${spriteTag(p)}<figcaption><p class="role">Now · #${p.species}</p>
    <p class="name">${esc(pretty(p.name))}</p>${typeChips(p.types)}</figcaption>`;

  const evos = p.to.map((s) => state.bySpecies.get(s)).filter(Boolean);
  if (p.form || !evos.length) { renderNoEvolution(p); renderFamily(p); return; }

  const ranked = evos.map((e) => ({ e, r: evaluate(p, e, state.prefs) }))
    .sort((a, b) => (a.r.blockers.length - b.r.blockers.length) || (b.r.score - a.r.score));
  if (!state.selectedEvo || !evos.includes(state.selectedEvo)) state.selectedEvo = ranked[0].e;

  $("#options").hidden = evos.length < 2;
  if (evos.length > 1) {
    $("#option-list").innerHTML = ranked.map(({ e, r }, i) => `
      <button class="option" role="tab" data-id="${e.id}" aria-selected="${e === state.selectedEvo}">
        ${spriteTag(e, "", 48)}<span><strong>${esc(pretty(e.name))}</strong><br>
        <span class="delta" style="color:${r.score >= 0 ? "var(--gain)" : "var(--loss)"}">${r.score >= 0 ? "+" : ""}${r.score.toFixed(0)}%</span>
        <span class="rank">${i === 0 ? "· best fit" : ""}${r.blockers.length ? "· deal-breaker" : ""}</span></span>
      </button>`).join("");
    document.querySelectorAll(".option").forEach((b) => b.addEventListener("click", () => {
      state.selectedEvo = state.byId.get(+b.dataset.id); render(p);
    }));
  }
  renderComparison(p, state.selectedEvo, ranked.find((x) => x.e === state.selectedEvo).r);
  renderFamily(p);
}

function renderNoEvolution(p) {
  $("#options").hidden = true;
  const v = $("#verdict");
  v.className = "verdict final";
  let msg, extra = "";
  if (p.form) {
    const base = state.bySpecies.get(p.species);
    msg = "No evolution data for this form";
    extra = `<p>This is an alternate form. The dataset only records evolutions for standard forms —
      see <a href="#${base.name}" style="color:#fff">${esc(pretty(base.name))}</a>.</p>`;
  } else if (p.from) {
    msg = "It's already fully evolved";
    extra = `<p>${esc(pretty(p.name))} is the last stage of its family, so there is nothing to decide.</p>`;
  } else {
    msg = "It doesn't evolve";
    extra = `<p>${esc(pretty(p.name))} has no evolutions in the dataset.</p>`;
  }
  v.innerHTML = `<p class="verdict-word">${msg}</p>${extra}`;
  $("#evolved").innerHTML = `<div class="noimg">No evolution</div><figcaption><p class="role">After</p>
    <p class="name">—</p></figcaption>`;
  $("#evolved").style.removeProperty("--tc");
  renderStats(p, p);
}

function renderComparison(cur, evo, r) {
  const c = evo.colors[0] || TYPE_COLORS[evo.types[0]];
  $("#evolved").style.setProperty("--tc", c);
  $("#evolved").innerHTML = `${spriteTag(evo)}<figcaption><p class="role">After evolving · #${evo.species}</p>
    <p class="name">${esc(pretty(evo.name))}</p>${typeChips(evo.types)}</figcaption>`;
  const v = $("#verdict");
  v.className = `verdict ${r.cls}`;
  const items = [...r.blockers.map((b) => `<li><strong>Deal-breaker:</strong> ${esc(b)}</li>`),
    ...r.reasons.map((x) => `<li>${esc(x)}</li>`)];
  v.innerHTML = `<p class="verdict-word">${r.word}</p>
    <p class="score">Weighted stats for “${PROFILES[state.prefs.profile].label}”: ${r.score >= 0 ? "+" : ""}${r.score.toFixed(1)}%</p>
    <ul>${items.join("")}</ul>`;
  renderStats(cur, evo);
}

function renderStats(cur, evo) {
  const max = 255;
  const rows = STATS.map(([k, label]) => {
    const a = cur.stats[k], b = evo.stats[k], d = b - a;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const after = d === 0 ? "" : `<span class="after ${d > 0 ? "up" : "down"}" style="left:${(lo / max) * 100}%;width:${((hi - lo) / max) * 100}%"></span>`;
    return `<tr><th scope="row">${label}</th><td class="n">${a}</td>
      <td><div class="bar" role="img" aria-label="${label}: ${a} now, ${b} after"><span class="now" style="width:${(lo / max) * 100}%"></span>${after}</div></td>
      <td class="n">${b}${d ? `<span class="diff ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : ""}${d}</span>` : ""}</td></tr>`;
  });
  const ta = total(cur.stats), tb = total(evo.stats), td = tb - ta;
  rows.push(`<tr class="total"><th scope="row">Total</th><td class="n">${ta}</td><td></td>
    <td class="n">${tb}${td ? `<span class="diff ${td > 0 ? "up" : "down"}">${td > 0 ? "+" : ""}${td}</span>` : ""}</td></tr>`);
  $("#stats tbody").innerHTML = rows.join("");

  const same = cur === evo;
  const ab = (p) => [...p.abilities.map(pretty), p.hidden ? `${pretty(p.hidden)} (hidden)` : null].filter(Boolean).join(", ");
  $("#facts").innerHTML = same
    ? `<dt>Abilities</dt><dd>${esc(ab(cur))}</dd><dt>Size</dt><dd>${fmtH(cur.height)}, ${fmtW(cur.weight)}</dd>`
    : `<dt>Abilities</dt><dd>${esc(ab(cur))} → ${esc(ab(evo))}</dd>
       <dt>Size</dt><dd>${fmtH(cur.height)}, ${fmtW(cur.weight)} → ${fmtH(evo.height)}, ${fmtW(evo.weight)}</dd>
       <dt>Experience when defeated</dt><dd>${cur.base_experience} → ${evo.base_experience}</dd>`;
}

function renderFamily(p) {
  const species = state.bySpecies.get(p.species);
  if (!species || !species.chain) { $("#line-panel").hidden = true; return; }
  const members = state.all.filter((x) => !x.form && x.chain === species.chain);
  const stageOf = (m) => { let s = 0, cur = m; while (cur.from) { s++; cur = state.bySpecies.get(cur.from); } return s; };
  const stages = [];
  members.forEach((m) => { (stages[stageOf(m)] ||= []).push(m); });
  $("#line-panel").hidden = members.length < 2;
  $("#family").innerHTML = stages.map((group, i) => `
    ${i ? '<li class="sep" aria-hidden="true">›</li>' : ""}
    <li><div class="stage">${group.map((m) => `<a href="#${m.name}" ${m.species === p.species ? 'aria-current="true"' : ""}>
      ${spriteTag(m, "", 48)}${esc(pretty(m.name))}</a>`).join("")}</div></li>`).join("");
}

// ------------------------------------------------------------------ preferences
function renderPrefs() {
  $("#profiles").innerHTML = Object.entries(PROFILES).map(([k, p]) => `
    <label><input type="radio" name="profile" value="${k}" ${state.prefs.profile === k ? "checked" : ""}>
    <strong>${p.label}</strong><span>${p.hint}</span></label>`).join("");
  document.querySelectorAll('input[name="profile"]').forEach((r) => r.addEventListener("change", () => {
    state.prefs.profile = r.value; savePrefs(); if (state.current) render(state.current);
  }));
  for (const id of ["keepType", "keepAbility", "keepSmall"]) {
    const el = $("#" + id);
    el.checked = state.prefs[id];
    el.addEventListener("change", () => { state.prefs[id] = el.checked; savePrefs(); if (state.current) render(state.current); });
  }
}

// ------------------------------------------------------------------ search
function setupSearch() {
  const input = $("#search"), list = $("#matches");
  let items = [], active = -1;
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const choose = (p) => { close(); input.value = pretty(p.name); location.hash = p.name; };
  const paint = () => {
    list.innerHTML = items.map((p, i) => `<li role="option" id="opt-${i}" aria-selected="${i === active}" data-i="${i}">
      ${p.img ? `<img src="${sprite(p)}" alt="" loading="lazy">` : "<span></span>"}
      <span>${esc(pretty(p.name))}</span><span class="num">#${p.species}</span></li>`).join("");
    list.hidden = !items.length;
    input.setAttribute("aria-expanded", String(!!items.length));
    if (active >= 0) input.setAttribute("aria-activedescendant", `opt-${active}`);
  };
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase().replace(/\s+/g, "-");
    if (!q) { items = []; close(); return; }
    const num = /^\d+$/.test(q) ? +q : null;
    items = state.all.filter((p) => (num !== null ? p.species === num || p.id === num : p.name.includes(q)))
      .sort((a, b) => (a.name.startsWith(q) ? 0 : 1) - (b.name.startsWith(q) ? 0 : 1) || a.form - b.form || a.species - b.species)
      .slice(0, 12);
    active = items.length ? 0 : -1;
    paint();
  });
  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") { active = Math.min(active + 1, items.length - 1); paint(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); paint(); e.preventDefault(); }
    else if (e.key === "Enter" && items[active]) { choose(items[active]); e.preventDefault(); }
    else if (e.key === "Escape") close();
  });
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li"); if (li) { choose(items[+li.dataset.i]); e.preventDefault(); }
  });
  input.addEventListener("blur", () => setTimeout(close, 120));
  $("#random").addEventListener("click", () => {
    const pool = state.all.filter((p) => !p.form && p.to.length);
    location.hash = pool[Math.floor(Math.random() * pool.length)].name;
  });
}

function route() {
  const key = decodeURIComponent(location.hash.slice(1)).toLowerCase();
  if (!key) return;
  const p = state.byName.get(key) || state.byId.get(+key);
  if (!p) return;
  if (state.current !== p) state.selectedEvo = null;
  $("#search").value = pretty(p.name);
  render(p);
}

// ------------------------------------------------------------------ boot
(async function boot() {
  try {
    const res = await fetch("data/pokemon.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.all = await res.json();
  } catch (err) {
    $("#empty").innerHTML = `<p>The Pokémon data could not be loaded (${esc(err.message)}). Open the site through a web
      server or GitHub Pages rather than as a local file.</p>`;
    return;
  }
  for (const p of state.all) {
    state.byId.set(p.id, p);
    state.byName.set(p.name, p);
    if (!p.form) state.bySpecies.set(p.species, p);
  }
  renderPrefs();
  setupSearch();
  window.addEventListener("hashchange", route);
  route();
})();
