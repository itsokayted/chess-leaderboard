const categories = {
  live_blitz: "Blitz",
  live_bullet: "Bullet",
  live_rapid: "Rapid",
  daily: "Daily",
};

let leaderboards = {};

function showCategory(key) {
  const tbody = document.getElementById("players");
  tbody.innerHTML = "";

  leaderboards[key].forEach(player => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${player.rank}</td>
      <td>${player.avatar ? `<img src="${player.avatar}" alt="">` : ""}${player.username}</td>
      <td class="rating">${player.score}</td>
      <td>${player.win_count} / ${player.loss_count} / ${player.draw_count}</td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("status").textContent = `Top 50 ${categories[key]} players`;

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.key === key);
  });
}

function buildTabs() {
  const nav = document.getElementById("tabs");
  Object.entries(categories).forEach(([key, label]) => {
    const button = document.createElement("button");
    button.className = "tab";
    button.dataset.key = key;
    button.textContent = label;
    button.addEventListener("click", () => showCategory(key));
    nav.appendChild(button);
  });
}

fetch("https://api.chess.com/pub/leaderboards")
  .then(response => response.json())
  .then(data => {
    leaderboards = data;
    buildTabs();
    showCategory("live_blitz");
  })
  .catch(() => {
    document.getElementById("status").textContent = "Couldn't load data.";
  });