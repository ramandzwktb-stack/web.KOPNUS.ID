/* ==========================================================================
   data.js
   Data DEMO / PROTOTYPE untuk Dashboard Pemilik — Kopi Nusantara.
   Nama usaha, cabang, menu & harga, serta bahan baku disesuaikan dengan
   studi kasus "Kopi Nusantara" (kedai kopi & roastery, Surabaya, rencana
   ekspansi ke Kendari, Makassar, dan Bali). Angka transaksi & stok tetap
   data dummy yang dibuat saling berhubungan, bukan data sungguhan.
   ========================================================================== */

// PRNG sederhana yang deterministik, supaya data demo tidak berubah-ubah
// setiap kali halaman dimuat ulang.
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rand = seededRandom(20240905);

function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

/* ------------------------------- Cabang -----------------------------------
   Surabaya adalah cabang utama (berdiri 2021). Kendari, Makassar, dan Bali
   adalah cabang hasil ekspansi yang baru dibuka, sehingga volumenya
   masih lebih kecil dibanding cabang utama.
---------------------------------------------------------------------------- */
const BRANCHES = [
  { id: "sby", name: "Cabang Surabaya (Utama)", city: "Surabaya", weight: 1.6 },
  { id: "kdi", name: "Cabang Kendari", city: "Kendari", weight: 0.55 },
  { id: "mks", name: "Cabang Makassar", city: "Makassar", weight: 0.6 },
  { id: "bli", name: "Cabang Bali", city: "Denpasar, Bali", weight: 0.8 },
];

/* -------------------------------- Menu -------------------------------------
   7 menu utama sesuai daftar harga pada studi kasus, ditambah biji kopi
   sangrai kemasan sebagai sumber pendapatan tambahan.
---------------------------------------------------------------------------- */
const MENU = [
  { name: "Kopi Hitam Americano", price: 15000 },
  { name: "Kopi Tubruk Lokal", price: 15000 },
  { name: "Es Kopi Susu Gula Aren", price: 18000 },
  { name: "Cappuccino Hangat", price: 22000 },
  { name: "V60 Manual Brew", price: 24000 },
  { name: "Es Matcha Latte", price: 25000 },
  { name: "Caramel Macchiato", price: 25000 },
  { name: "Biji Kopi Sangrai 200g (Kemasan)", price: 45000 },
];

/* ---------------------------- Bahan Baku -----------------------------------
   Bahan baku untuk kedai kopi & roastery: biji kopi hijau yang disangrai
   mandiri, biji kopi sangrai siap seduh, serta bahan pelengkap minuman.
---------------------------------------------------------------------------- */
const INGREDIENTS = [
  { name: "Biji Kopi Hijau", unit: "kg", low: 12, critical: 4 },
  { name: "Biji Kopi Sangrai", unit: "kg", low: 8, critical: 3 },
  { name: "Susu Full Cream", unit: "liter", low: 15, critical: 5 },
  { name: "Gula Aren Cair", unit: "liter", low: 5, critical: 1.5 },
  { name: "Sirup Karamel", unit: "liter", low: 3, critical: 1 },
  { name: "Bubuk Matcha", unit: "kg", low: 2, critical: 0.5 },
  { name: "Es Batu", unit: "kg", low: 20, critical: 7 },
  { name: "Cup & Tutup Gelas", unit: "pcs", low: 150, critical: 50 },
  { name: "Kemasan Biji Kopi", unit: "pcs", low: 30, critical: 10 },
];

const OWNER = {
  name: "Rizky Pratama",
  role: "Pemilik / Pengelola",
  business: "Kopi Nusantara",
  tagline: "Kedai Kopi & Roastery \u00b7 Berdiri 2021",
};

/* ---------------------------- Generate Transaksi ---------------------------
   30 hari terakhir, per cabang, jumlah transaksi per hari mengikuti "weight"
   cabang: Surabaya sebagai cabang utama jauh lebih ramai (mendekati acuan
   studi kasus \u2248100 gelas/hari), cabang ekspansi masih lebih kecil.
---------------------------------------------------------------------------- */
const DAYS_BACK = 30;
const today = new Date();
today.setHours(9, 0, 0, 0);

const TRANSACTIONS = [];
let txCounter = 1;

for (let d = DAYS_BACK - 1; d >= 0; d--) {
  const day = new Date(today);
  day.setDate(day.getDate() - d);
  const isWeekend = [0, 6].includes(day.getDay());

  BRANCHES.forEach((branch) => {
    const base = randInt(34, 42);
    const count = Math.round(base * branch.weight * (isWeekend ? 1.2 : 1));

    for (let i = 0; i < count; i++) {
      const itemCount = rand() < 0.8 ? 1 : 2;
      const items = [];
      for (let k = 0; k < itemCount; k++) {
        const menu = pick(MENU);
        const qty = rand() < 0.7 ? 1 : 2;
        items.push({ menu: menu.name, qty, price: menu.price, subtotal: menu.price * qty });
      }
      const total = items.reduce((s, it) => s + it.subtotal, 0);
      const hour = randInt(9, 22);
      const minute = randInt(0, 59);
      const time = new Date(day);
      time.setHours(hour, minute, 0, 0);

      TRANSACTIONS.push({
        id: "TRX-" + String(txCounter++).padStart(5, "0"),
        branchId: branch.id,
        date: time,
        items,
        total,
      });
    }
  });
}
TRANSACTIONS.sort((a, b) => b.date - a.date);

/* ------------------------------- Stok Saat Ini ------------------------------ */
const STOCK = [];
BRANCHES.forEach((branch) => {
  INGREDIENTS.forEach((ing) => {
    const roll = rand();
    let qty;
    if (roll < 0.15) qty = +(ing.critical * rand()).toFixed(1); // kritis
    else if (roll < 0.35) qty = +(ing.low * (0.5 + rand() * 0.5)).toFixed(1); // menipis
    else qty = +(ing.low * (1.5 + rand() * 2.5)).toFixed(1); // aman

    STOCK.push({
      branchId: branch.id,
      ingredient: ing.name,
      unit: ing.unit,
      qty,
      low: ing.low,
      critical: ing.critical,
    });
  });
});

function stockStatus(item) {
  if (item.qty <= item.critical) return "kritis";
  if (item.qty <= item.low) return "menipis";
  return "aman";
}

/* --------------------------- Riwayat Penambahan Stok ------------------------- */
const STOCK_ADDITIONS = [];
for (let d = DAYS_BACK - 1; d >= 0; d -= randInt(1, 3)) {
  const day = new Date(today);
  day.setDate(day.getDate() - d);

  BRANCHES.forEach((branch) => {
    if (rand() < 0.6) {
      const ing = pick(INGREDIENTS);
      const qty = +(ing.low * (0.6 + rand() * 1.2)).toFixed(1);
      STOCK_ADDITIONS.push({
        branchId: branch.id,
        ingredient: ing.name,
        unit: ing.unit,
        qty,
        date: new Date(day),
      });
    }
  });
}
STOCK_ADDITIONS.sort((a, b) => b.date - a.date);

/* ------------------------------ Helper Umum --------------------------------- */
function branchName(id) {
  const b = BRANCHES.find((x) => x.id === id);
  return b ? b.name : id;
}

function formatRupiah(n) {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

function formatTanggal(d) {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatWaktu(d) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// Rentang tanggal berdasarkan periode: 'today' | 'week' | 'month'
function periodStart(period) {
  const d = new Date(today);
  if (period === "today") {
    d.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function filterTransactions(branchId, period) {
  const start = periodStart(period);
  return TRANSACTIONS.filter((t) => {
    const branchOk = branchId === "all" || t.branchId === branchId;
    const dateOk = t.date >= start;
    return branchOk && dateOk;
  });
}

function filterStock(branchId) {
  return STOCK.filter((s) => branchId === "all" || s.branchId === branchId);
}

function filterStockAdditions(branchId) {
  return STOCK_ADDITIONS.filter((s) => branchId === "all" || s.branchId === branchId);
}
