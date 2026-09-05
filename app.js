/* ==========================================================================
   app.js
   Logika aplikasi: navigasi sidebar, filter cabang & periode, dan rendering
   setiap halaman. Grafik dibuat manual dengan SVG (tanpa library eksternal)
   supaya prototype tetap berjalan sepenuhnya offline.
   ========================================================================== */

const state = {
  branch: "all",
  periods: { dashboard: "month", income: "month", "top-menu": "month" },
};

const PERIOD_LABEL = { today: "hari ini", week: "7 hari terakhir", month: "30 hari terakhir" };

/* ------------------------------- Setup awal -------------------------------- */
function populateBranchSelect() {
  const select = document.getElementById("global-branch-select");
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "Semua Cabang";
  select.appendChild(optAll);
  BRANCHES.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => {
    state.branch = select.value;
    updateTopbarSubtitle();
    renderAll();
  });
}

function updateTopbarSubtitle() {
  const el = document.getElementById("topbar-subtitle");
  if (state.branch === "all") {
    el.textContent = `Memantau ${BRANCHES.length} cabang`;
  } else {
    el.textContent = `Menampilkan data ${branchName(state.branch)}`;
  }
}

function setupNav() {
  const buttons = document.querySelectorAll(".nav-item");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      document.getElementById("page-" + btn.dataset.page).classList.add("active");
    });
  });
}

function setupSegmented() {
  document.querySelectorAll("[data-period-group]").forEach((group) => {
    const page = group.dataset.periodGroup;
    group.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.periods[page] = btn.dataset.period;
        if (page === "dashboard") renderDashboard();
        if (page === "income") renderIncome();
        if (page === "top-menu") renderTopMenu();
      });
    });
  });
}

/* ------------------------------- Agregasi data ------------------------------ */
function getBuckets(period) {
  if (period === "today") {
    const buckets = [];
    for (let h = 9; h <= 21; h += 2) buckets.push({ label: h + ":00", hourStart: h, hourEnd: h + 1 });
    return buckets;
  }
  const days = period === "week" ? 7 : 30;
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets.push({ label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" }), key: fmtDate(d) });
  }
  return buckets;
}

function incomeSeries(branchId, period) {
  const buckets = getBuckets(period);
  const txs = filterTransactions(branchId, period);
  const values = buckets.map(() => 0);

  txs.forEach((t) => {
    if (period === "today") {
      const h = t.date.getHours();
      const idx = buckets.findIndex((b) => h >= b.hourStart && h <= b.hourEnd);
      if (idx >= 0) values[idx] += t.total;
    } else {
      const key = fmtDate(t.date);
      const idx = buckets.findIndex((b) => b.key === key);
      if (idx >= 0) values[idx] += t.total;
    }
  });

  return { labels: buckets.map((b) => b.label), values };
}

function topMenuAgg(branchId, period, limit) {
  const txs = filterTransactions(branchId, period);
  const map = {};
  txs.forEach((t) => t.items.forEach((it) => { map[it.menu] = (map[it.menu] || 0) + it.qty; }));
  return Object.entries(map)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit || 10);
}

/* --------------------------------- Grafik SVG -------------------------------- */
function drawBarChart(container, labels, values, opts = {}) {
  const formatter = opts.formatter || ((v) => v);
  const height = opts.height || 220;
  const n = labels.length;
  const slot = n > 20 ? 24 : n > 10 ? 34 : 56;
  const width = Math.max(n * slot, 320);
  const padBottom = 26, padTop = 12;
  const max = Math.max(...values, 1) * 1.15;
  const barAreaHeight = height - padBottom - padTop;
  const labelEvery = n <= 12 ? 1 : Math.ceil(n / 10);

  let bars = "";
  let axisLabels = "";
  labels.forEach((lab, i) => {
    const v = values[i];
    const barW = slot * 0.55;
    const x = i * slot + (slot - barW) / 2;
    const barH = max ? (v / max) * barAreaHeight : 0;
    const y = padTop + (barAreaHeight - barH);
    bars += `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH, 1).toFixed(1)}" rx="3"><title>${lab}: ${formatter(v)}</title></rect>`;
    if (i % labelEvery === 0) {
      axisLabels += `<text class="axis-label" x="${(x + barW / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle">${lab}</text>`;
    }
  });

  container.innerHTML = `<svg class="bar-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <line class="axis-line" x1="0" y1="${padTop + barAreaHeight}" x2="${width}" y2="${padTop + barAreaHeight}"/>
    ${bars}${axisLabels}
  </svg>`;
}

function drawRankChart(container, items) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">Belum ada data penjualan pada periode ini.</div>`;
    return;
  }
  const max = Math.max(...items.map((i) => i.qty), 1);
  const rowH = 30, gap = 12, leftLabelW = 170, chartW = 360;
  const width = leftLabelW + chartW + 60;
  const height = items.length * (rowH + gap);

  let rows = "";
  items.forEach((it, i) => {
    const y = i * (rowH + gap);
    const barW = (it.qty / max) * chartW;
    const label = it.name.length > 22 ? it.name.slice(0, 21) + "…" : it.name;
    rows += `
      <text class="rank-label" x="0" y="${y + rowH / 2 + 4}">${label}</text>
      <rect class="bar" x="${leftLabelW}" y="${y + 3}" width="${Math.max(barW, 2).toFixed(1)}" height="${rowH - 6}" rx="4"><title>${it.name}: ${it.qty} porsi</title></rect>
      <text class="rank-value" x="${(leftLabelW + barW + 10).toFixed(1)}" y="${y + rowH / 2 + 4}">${it.qty} porsi</text>`;
  });

  container.innerHTML = `<svg class="rank-bar" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}

/* -------------------------------- Render: Dashboard --------------------------- */
function renderDashboard() {
  const period = state.periods.dashboard;
  const txs = filterTransactions(state.branch, period);
  const income = txs.reduce((s, t) => s + t.total, 0);
  const stock = filterStock(state.branch);
  const stockAman = stock.filter((s) => stockStatus(s) !== "kritis").length;
  const top = topMenuAgg(state.branch, period, 1)[0];
  const branchCount = state.branch === "all" ? BRANCHES.length : 1;

  const grid = document.getElementById("dash-stat-grid");
  grid.innerHTML = `
    <div class="stat-card stat-card--hero">
      <div class="stat-label">Total Pemasukan &middot; ${PERIOD_LABEL[period]}</div>
      <div class="stat-value">${formatRupiah(income)}</div>
      <div class="stat-delta">${txs.length} transaksi tercatat</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Transaksi</div>
      <div class="stat-value">${txs.length}</div>
      <div class="stat-sub">${PERIOD_LABEL[period]}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Jumlah Cabang</div>
      <div class="stat-value">${branchCount}</div>
      <div class="stat-sub">${state.branch === "all" ? "Seluruh kota" : branchName(state.branch)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Stok Aman</div>
      <div class="stat-value">${stockAman}/${stock.length}</div>
      <div class="stat-sub">jenis bahan</div>
    </div>
  `;

  document.getElementById("dash-income-hint").textContent = PERIOD_LABEL[period];
  const series = incomeSeries(state.branch, period);
  drawBarChart(document.getElementById("dash-income-chart"), series.labels, series.values, { formatter: formatRupiah });

  const topList = topMenuAgg(state.branch, period, 5);
  const topContainer = document.getElementById("dash-top-menu");
  if (!topList.length) {
    topContainer.innerHTML = `<div class="empty-state">Belum ada data penjualan.</div>`;
  } else {
    topContainer.innerHTML = topList
      .map((it, i) => `
        <div class="top-menu-row">
          <div class="top-menu-row__rank">${i + 1}</div>
          <div class="top-menu-row__name">${it.name}</div>
          <div class="top-menu-row__qty">${it.qty} porsi</div>
        </div>`)
      .join("");
  }
}

/* --------------------------------- Render: Pemasukan --------------------------- */
function renderIncome() {
  const period = state.periods.income;
  const txs = filterTransactions(state.branch, period);
  const income = txs.reduce((s, t) => s + t.total, 0);
  const avg = txs.length ? income / txs.length : 0;
  const days = period === "today" ? 1 : period === "week" ? 7 : 30;

  document.getElementById("income-stat-grid").innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Pemasukan</div>
      <div class="stat-value">${formatRupiah(income)}</div>
      <div class="stat-sub">${PERIOD_LABEL[period]}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Rata-rata / Transaksi</div>
      <div class="stat-value">${formatRupiah(avg)}</div>
      <div class="stat-sub">${txs.length} transaksi</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Rata-rata / Hari</div>
      <div class="stat-value">${formatRupiah(income / days)}</div>
      <div class="stat-sub">${state.branch === "all" ? "Seluruh cabang" : branchName(state.branch)}</div>
    </div>
  `;

  document.getElementById("income-chart-hint").textContent = `${state.branch === "all" ? "Semua cabang" : branchName(state.branch)} \u00b7 ${PERIOD_LABEL[period]}`;
  const series = incomeSeries(state.branch, period);
  drawBarChart(document.getElementById("income-chart"), series.labels, series.values, { formatter: formatRupiah, height: 260 });
}

/* -------------------------------- Render: Transaksi ---------------------------- */
function renderTransactions() {
  const txs = filterTransactions(state.branch, "month").slice(0, 120);
  document.getElementById("tx-count-hint").textContent = `${txs.length} transaksi \u00b7 30 hari terakhir`;
  const body = document.getElementById("tx-table-body");

  if (!txs.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">Belum ada transaksi.</td></tr>`;
    return;
  }

  body.innerHTML = txs
    .map((t) => {
      const menuSummary = t.items.map((it) => `${it.menu} x${it.qty}`).join(", ");
      return `<tr>
        <td>${t.id}</td>
        <td>${formatTanggal(t.date)} &middot; ${formatWaktu(t.date)}</td>
        <td><span class="city-chip">${branchName(t.branchId)}</span></td>
        <td>${menuSummary}</td>
        <td class="num">${t.items.reduce((s, it) => s + it.qty, 0)}</td>
        <td class="num">${formatRupiah(t.total)}</td>
      </tr>`;
    })
    .join("");
}

/* ---------------------------------- Render: Stok -------------------------------- */
function renderStock() {
  const stock = filterStock(state.branch).slice().sort((a, b) => {
    const order = { kritis: 0, menipis: 1, aman: 2 };
    return order[stockStatus(a)] - order[stockStatus(b)];
  });
  const body = document.getElementById("stock-table-body");

  if (!stock.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state">Tidak ada data stok.</td></tr>`;
    return;
  }

  body.innerHTML = stock
    .map((s) => {
      const status = stockStatus(s);
      const labelMap = { aman: "Aman", menipis: "Menipis", kritis: "Kritis" };
      return `<tr>
        <td>${s.ingredient}</td>
        <td class="num">${s.qty}</td>
        <td>${s.unit}</td>
        <td><span class="city-chip">${branchName(s.branchId)}</span></td>
        <td><span class="badge badge--${status}"><span class="dot"></span>${labelMap[status]}</span></td>
      </tr>`;
    })
    .join("");
}

/* --------------------------- Render: Penambahan Stok ---------------------------- */
function renderStockAdd() {
  const list = filterStockAdditions(state.branch);
  document.getElementById("stock-add-hint").textContent = `${list.length} catatan \u00b7 30 hari terakhir`;
  const body = document.getElementById("stock-add-table-body");

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada riwayat penambahan stok.</td></tr>`;
    return;
  }

  body.innerHTML = list
    .map((s) => `<tr>
      <td>${s.ingredient}</td>
      <td class="num">+${s.qty}</td>
      <td>${s.unit}</td>
      <td><span class="city-chip">${branchName(s.branchId)}</span></td>
      <td>${formatTanggal(s.date)}</td>
    </tr>`)
    .join("");
}

/* ------------------------------- Render: Menu Terlaris --------------------------- */
function renderTopMenu() {
  const period = state.periods["top-menu"];
  document.getElementById("top-menu-hint").textContent = `${state.branch === "all" ? "Semua cabang" : branchName(state.branch)} \u00b7 ${PERIOD_LABEL[period]}`;
  const items = topMenuAgg(state.branch, period, 10);
  drawRankChart(document.getElementById("top-menu-chart"), items);
}

/* ---------------------------------- Render: Cabang -------------------------------- */
function renderBranches() {
  const grid = document.getElementById("branch-grid");
  grid.innerHTML = BRANCHES.map((b) => {
    const txs = filterTransactions(b.id, "month");
    const income = txs.reduce((s, t) => s + t.total, 0);
    const stock = filterStock(b.id);
    const kritis = stock.filter((s) => stockStatus(s) === "kritis").length;
    const top = topMenuAgg(b.id, "month", 1)[0];
    return `<div class="branch-card" data-branch="${b.id}">
      <div class="branch-card__top">
        <div>
          <div class="branch-card__name">${b.name}</div>
          <div class="branch-card__city">${b.city}</div>
        </div>
        <span class="city-chip">30 hari</span>
      </div>
      <div class="branch-card__metrics">
        <div>
          <div class="branch-card__metric-label">Pemasukan</div>
          <div class="branch-card__metric-value">${formatRupiah(income)}</div>
        </div>
        <div>
          <div class="branch-card__metric-label">Transaksi</div>
          <div class="branch-card__metric-value">${txs.length}</div>
        </div>
        <div>
          <div class="branch-card__metric-label">Stok Kritis</div>
          <div class="branch-card__metric-value">${kritis} bahan</div>
        </div>
        <div>
          <div class="branch-card__metric-label">Menu Terlaris</div>
          <div class="branch-card__metric-value">${top ? top.name : "-"}</div>
        </div>
      </div>
      <div class="branch-card__footer">Klik untuk melihat detail cabang ini di <b>Dashboard</b>.</div>
    </div>`;
  }).join("");

  grid.querySelectorAll(".branch-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.branch;
      state.branch = id;
      document.getElementById("global-branch-select").value = id;
      updateTopbarSubtitle();
      renderAll();
      document.querySelector('.nav-item[data-page="dashboard"]').click();
    });
  });
}

/* ------------------------------------ Init ---------------------------------------- */
function renderAll() {
  renderDashboard();
  renderIncome();
  renderTransactions();
  renderStock();
  renderStockAdd();
  renderTopMenu();
  renderBranches();
}

document.addEventListener("DOMContentLoaded", () => {
  populateBranchSelect();
  updateTopbarSubtitle();
  setupNav();
  setupSegmented();
  renderAll();
});
