const API = "https://api.chess.com/pub";

// Known categories in display order, with friendly labels.
const CATEGORIES = [
  ["live_blitz", "Blitz", "⚡"],
  ["live_bullet", "Bullet", "🔫"],
  ["live_rapid", "Rapid", "⏱"],
  ["daily", "Daily", "☀"],
  ["live_blitz960", "Blitz 960", "🎲"],
  ["daily960", "Daily 960", "🎲"],
  ["live_bughouse", "Bughouse", "🐞"],
  ["live_crazyhouse", "Crazyhouse", "🏠"],
  ["live_threecheck", "3-Check", "✔"],
  ["live_kingofthehill", "King of the Hill", "⛰"],
  ["tactics", "Puzzles", "🧩"],
  ["rush", "Puzzle Rush", "🏃"],
  ["battle", "Puzzle Battle", "⚔"],
];
const LABELS = Object.fromEntries(CATEGORIES.map(([k, l, i]) => [k, { label: l, icon: i }]));
const prettify = k => k.replace(/^live_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

// Player-stats keys -> leaderboard keys, for "where would they rank?"
const STAT_TO_BOARD = {
  chess_blitz: "live_blitz", chess_bullet: "live_bullet", chess_rapid: "live_rapid",
  chess_daily: "daily", chess960_daily: "daily960", tactics: "tactics",
};
const STAT_LABELS = {
  chess_blitz: "Blitz", chess_bullet: "Bullet", chess_rapid: "Rapid", chess_daily: "Daily",
  chess960_daily: "Daily 960", tactics: "Puzzles", puzzle_rush: "Puzzle Rush", fide: "FIDE",
};

const state = { data: null, cat: "live_blitz", sort: { key: "rank", dir: 1 }, filter: "", country: "" };
const $ = s => document.querySelector(s);

function safeStore(k, v) { try { v === undefined ? (v = localStorage.getItem(k)) : localStorage.setItem(k, v); } catch { return null; } return v; }

function isoFromCountryUrl(url) { return (url || "").split("/").pop().toUpperCase(); }
function flag(iso) {
  if (!/^[A-Z]{2}$/.test(iso)) return "🏳";
  return String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
let regionNames; try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch {}
const countryName = iso => { try { return regionNames?.of(iso) || iso; } catch { return iso; } };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => (n ?? n === 0) ? Number(n).toLocaleString() : "—";

function avatarHtml(p, cls = "avatar") {
  const initial = esc((p.username || "?")[0].toUpperCase());
  if (p.avatar) return `<img class="${cls}" src="${esc(p.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;${cls}&quot;>${initial}</div>'">`;
  return `<div class="${cls}">${initial}</div>`;
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) throw Object.assign(new Error("Not found"), { status: 404 });
  if (res.status === 429) throw new Error("Chess.com is rate-limiting requests. Wait a moment and try again.");
  if (!res.ok) throw new Error(`Chess.com returned ${res.status}`);
  return res.json();
}

async function loadBoards() {
  $("#state").hidden = false;
  $("#state").innerHTML = `<div class="spinner"></div>Loading leaderboards…`;
  $("#rows").innerHTML = ""; $("#podium").innerHTML = "";
  try {
    state.data = await getJSON(`${API}/leaderboards`);
    $("#updated").textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    buildTabs();
    render();
  } catch (e) {
    $("#updated").textContent = "Couldn't load";
    $("#state").innerHTML = `<strong>Couldn't reach Chess.com</strong>${esc(e.message)}.<br>Check your connection, then hit Refresh.`;
  }
}

function buildTabs() {
  const keys = Object.keys(state.data).filter(k => Array.isArray(state.data[k]) && state.data[k].length);
  const ordered = [...CATEGORIES.map(c => c[0]).filter(k => keys.includes(k)), ...keys.filter(k => !LABELS[k])];
  if (!ordered.includes(state.cat)) state.cat = ordered[0];
  $("#tabs").innerHTML = ordered.map(k => {
    const l = LABELS[k] || { label: prettify(k), icon: "♟" };
    return `<button class="tab" role="tab" data-cat="${k}" aria-selected="${k === state.cat}"><span>${l.icon}</span>${esc(l.label)}</button>`;
  }).join("");
}

function currentPlayers() {
  const list = (state.data?.[state.cat] || []).map(p => ({
    ...p,
    iso: isoFromCountryUrl(p.country),
    games: (p.win_count || 0) + (p.loss_count || 0) + (p.draw_count || 0),
    trendVal: p.trend_score ? (p.trend_score.direction || 0) * (p.trend_score.delta || 0) : 0,
  }));
  return list;
}

function render() {
  if (!state.data) return;
  const all = currentPlayers();

  // Country dropdown for this board
  const isos = [...new Set(all.map(p => p.iso).filter(Boolean))].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  if (state.country && !isos.includes(state.country)) state.country = "";
  $("#country").innerHTML = `<option value="">All countries</option>` +
    isos.map(i => `<option value="${i}" ${i === state.country ? "selected" : ""}>${flag(i)} ${esc(countryName(i))}</option>`).join("");

  // Podium (unfiltered top 3)
  const medals = [["1", "var(--accent-2)"], ["2", "var(--silver)"], ["3", "var(--bronze)"]];
  $("#podium").innerHTML = all.slice(0, 3).map((p, i) => `
    <div class="pod" style="--c:${medals[i][1]}" data-user="${esc(p.username)}">
      <div class="medal">${medals[i][0]}</div>
      ${avatarHtml(p)}
      <div style="min-width:0">
        <div class="name">${p.title ? `<span class="title">${esc(p.title)}</span>` : ""}${esc(p.username)} <span class="flag">${flag(p.iso)}</span></div>
        <div class="rating">${fmt(p.score)}</div>
      </div>
    </div>`).join("");

  // Filter + sort
  const q = state.filter.trim().toLowerCase();
  let rows = all.filter(p =>
    (!q || p.username?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q)) &&
    (!state.country || p.iso === state.country));
  const { key, dir } = state.sort;
  const val = p => key === "trend" ? p.trendVal : key === "games" ? p.games : p[key] ?? 0;
  rows.sort((a, b) => (val(a) - val(b)) * dir);

  const hasWLD = all.some(p => p.win_count != null);
  $("#rows").innerHTML = rows.map(p => {
    const t = p.trend_score || {};
    const tCls = t.direction > 0 ? "up" : t.direction < 0 ? "down" : "flat";
    const tTxt = t.direction > 0 ? `▲ ${t.delta}` : t.direction < 0 ? `▼ ${t.delta}` : "–";
    const g = p.games || 1;
    return `<tr data-user="${esc(p.username)}">
      <td class="rank ${p.rank <= 3 ? "top" : ""}">${p.rank}</td>
      <td><div class="player">${avatarHtml(p)}<div style="min-width:0">
        <div class="pname">${p.title ? `<span class="title">${esc(p.title)}</span>` : ""}${esc(p.username)}</div>
        ${p.name ? `<div class="realname">${esc(p.name)}</div>` : ""}
      </div></div></td>
      <td class="hide-sm"><span class="flag" title="${esc(countryName(p.iso))}">${flag(p.iso)}</span></td>
      <td class="num score">${fmt(p.score)}</td>
      <td class="num hide-sm">${hasWLD ? `<div class="wld"><span class="w">${fmt(p.win_count)}</span> / <span class="l">${fmt(p.loss_count)}</span> / <span class="d">${fmt(p.draw_count)}</span></div>
        <div class="bar"><span style="width:${(p.win_count||0)/g*100}%;background:var(--up)"></span><span style="width:${(p.draw_count||0)/g*100}%;background:var(--muted)"></span><span style="width:${(p.loss_count||0)/g*100}%;background:var(--down)"></span></div>` : "—"}</td>
      <td class="num hide-sm"><span class="trend ${tCls}">${tTxt}</span></td>
    </tr>`;
  }).join("");

  $("#state").hidden = rows.length > 0;
  if (!rows.length) $("#state").innerHTML = `<strong>No players match</strong>Try a different name or country.`;

  document.querySelectorAll("th.sortable").forEach(th => {
    th.textContent = th.textContent.replace(/ [▲▼]$/, "");
    if (th.dataset.sort === key) th.textContent += dir > 0 ? " ▲" : " ▼";
  });
}

/* ---------- Player drawer ---------- */
function openDrawer() { $("#drawer").classList.add("open"); $("#scrim").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); }
function closeDrawer() { $("#drawer").classList.remove("open"); $("#scrim").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); }

function whereWouldRank(boardKey, rating) {
  const board = state.data?.[boardKey];
  if (!board?.length || rating == null) return "";
  const cutoff = board[board.length - 1].score;
  if (rating < cutoff) return `${fmt(cutoff - rating)} pts short of the top ${board.length}`;
  const pos = board.filter(p => p.score > rating).length + 1;
  return `Top-${board.length} level · would be #${pos}`;
}

async function showPlayer(username) {
  username = username.trim().toLowerCase();
  if (!username) return;
  openDrawer();
  $("#drawerBody").innerHTML = `<div class="state"><div class="spinner"></div>Loading ${esc(username)}…</div>`;
  try {
    const profile = await getJSON(`${API}/player/${encodeURIComponent(username)}`);
    const stats = await getJSON(`${API}/player/${encodeURIComponent(username)}/stats`).catch(() => ({}));
    const iso = isoFromCountryUrl(profile.country);
    const joined = profile.joined ? new Date(profile.joined * 1000).toLocaleDateString([], { year: "numeric", month: "short" }) : null;

    const cards = Object.keys(STAT_LABELS).filter(k => stats[k] != null).map(k => {
      const s = stats[k];
      if (k === "fide") return `<div class="stat"><div class="k">FIDE</div><div class="v">${fmt(s)}</div></div>`;
      if (k === "tactics") return `<div class="stat"><div class="k">Puzzles</div><div class="v">${fmt(s.highest?.rating)}</div><div class="s">highest</div><div class="where">${esc(whereWouldRank("tactics", s.highest?.rating))}</div></div>`;
      if (k === "puzzle_rush") return `<div class="stat"><div class="k">Puzzle Rush</div><div class="v">${fmt(s.best?.score)}</div><div class="s">best score</div></div>`;
      const r = s.record || {};
      return `<div class="stat"><div class="k">${STAT_LABELS[k]}</div><div class="v">${fmt(s.last?.rating)}</div>
        <div class="s">Best ${fmt(s.best?.rating)} · ${fmt(r.win)}W ${fmt(r.loss)}L ${fmt(r.draw)}D</div>
        <div class="where">${esc(whereWouldRank(STAT_TO_BOARD[k], s.last?.rating))}</div></div>`;
    }).join("");

    $("#drawerBody").innerHTML = `
      <div class="profile-head">${avatarHtml(profile)}<div style="min-width:0">
        <h2>${profile.title ? `<span class="title">${esc(profile.title)}</span>` : ""}${esc(profile.username)}</h2>
        <div class="meta">${profile.name ? esc(profile.name) + " · " : ""}${flag(iso)} ${esc(countryName(iso))}</div>
        <div class="meta">${joined ? "Joined " + joined + " · " : ""}${fmt(profile.followers)} followers</div>
      </div></div>
      <h3>Ratings</h3>
      ${cards ? `<div class="grid">${cards}</div>` : `<p class="meta">No rated games yet.</p>`}
      <a class="btn profile-link" href="${esc(profile.url)}" target="_blank" rel="noopener">View on Chess.com ↗</a>`;
  } catch (e) {
    $("#drawerBody").innerHTML = `<div class="state"><strong>${e.status === 404 ? "No player called “" + esc(username) + "”" : "Couldn't load player"}</strong>${e.status === 404 ? "Check the spelling and try again." : esc(e.message)}</div>`;
  }
}

/* ---------- Events ---------- */
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest(".tab"); if (!b) return;
  state.cat = b.dataset.cat; safeStore("cat", state.cat);
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", t === b));
  state.sort = { key: "rank", dir: 1 };
  render();
});
$("#filter").addEventListener("input", e => { state.filter = e.target.value; render(); });
$("#country").addEventListener("change", e => { state.country = e.target.value; render(); });
document.querySelectorAll("th.sortable").forEach(th => th.addEventListener("click", () => {
  const key = th.dataset.sort;
  state.sort = state.sort.key === key ? { key, dir: -state.sort.dir } : { key, dir: key === "rank" ? 1 : -1 };
  render();
}));
document.addEventListener("click", e => {
  const el = e.target.closest("[data-user]");
  if (el && !e.target.closest("a")) showPlayer(el.dataset.user);
});
$("#lookup").addEventListener("submit", e => { e.preventDefault(); showPlayer($("#lookupInput").value); });
$("#closeDrawer").addEventListener("click", closeDrawer);
$("#scrim").addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });
$("#refresh").addEventListener("click", loadBoards);

state.cat = safeStore("cat") || state.cat;
loadBoards();
