/* =====================================================
   NexVault Bank — script.js
   Mirrors C concepts:
     struct Account  → JS plain object (accountDB map)
     struct Txn      → JS transaction object
     fopen/fwrite    → downloadFile() helper
     Functions       → deposit(), withdraw(), getBalance()
   ===================================================== */

"use strict";

/* ───────────────────────────────────────────────────
   DATA LAYER  (C equivalent: struct + in-memory array)
   ─────────────────────────────────────────────────── */

// C: struct Account { char accNo[10]; char name[50]; char email[80];
//                     float balance; char pin[5]; time_t openedAt;
//                     struct Transaction txns[500]; int txnCount; };
function createAccount(name, email, initialDeposit, pin) {
  const accNo  = generateAccNo();
  const now    = new Date();
  const txn    = createTransaction("deposit", initialDeposit, "Account opening deposit", initialDeposit);
  return {
    accNo,
    name,
    email,
    balance     : initialDeposit,
    pin,
    openedAt    : now.toISOString(),
    transactions: [txn],   // C: struct Transaction txns[]
    totalDeposited  : initialDeposit,
    totalWithdrawn  : 0,
  };
}

// C: struct Transaction { char type[12]; float amount; char remark[100];
//                          float balanceAfter; char datetime[30]; };
function createTransaction(type, amount, remark, balanceAfter) {
  return {
    id          : Date.now() + Math.random().toString(36).slice(2, 6),
    type,                      // "deposit" | "withdrawal"
    amount,
    remark      : remark || "—",
    balanceAfter,
    datetime    : new Date().toISOString(),
  };
}

// In-memory "file" (C: array of struct Account on disk)
const accountDB = new Map();   // key: accNo, value: Account object
let currentAccount = null;     // C: Account *activePtr

/* ───────────────────────────────────────────────────
   BANKING FUNCTIONS  (C: void deposit(), void withdraw()…)
   ─────────────────────────────────────────────────── */

// C: float getBalance(Account *a) { return a->balance; }
function getBalance(acc) {
  return acc.balance;
}

// C: int deposit(Account *a, float amount, char *remark)
function deposit(acc, amount, remark) {
  if (amount <= 0)          return { ok: false, msg: "Amount must be greater than ₹0." };
  if (!isFinite(amount))    return { ok: false, msg: "Invalid amount." };

  acc.balance         += amount;
  acc.totalDeposited  += amount;
  const txn            = createTransaction("deposit", amount, remark, acc.balance);
  acc.transactions.push(txn);
  return { ok: true, msg: `Deposited ₹${fmt(amount)} successfully. New balance: ₹${fmt(acc.balance)}`, txn };
}

// C: int withdraw(Account *a, float amount, char *remark)
function withdraw(acc, amount, remark) {
  if (amount <= 0)          return { ok: false, msg: "Amount must be greater than ₹0." };
  if (!isFinite(amount))    return { ok: false, msg: "Invalid amount." };
  if (amount > acc.balance) return { ok: false, msg: `Insufficient funds. Available: ₹${fmt(acc.balance)}` };

  acc.balance         -= amount;
  acc.totalWithdrawn  += amount;
  const txn            = createTransaction("withdrawal", amount, remark, acc.balance);
  acc.transactions.push(txn);
  return { ok: true, msg: `Withdrawn ₹${fmt(amount)} successfully. New balance: ₹${fmt(acc.balance)}`, txn };
}

// C: char* generateAccNo()
function generateAccNo() {
  const seq = String(accountDB.size + 1).padStart(6, "0");
  return `NV-${seq}`;
}

/* ───────────────────────────────────────────────────
   FILE HANDLING  (C: fopen, fwrite, fprintf, fclose)
   ─────────────────────────────────────────────────── */

// C: FILE *fp = fopen("account.json","w"); fprintf(fp,…); fclose(fp);
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// JSON export — C: fwrite(&account, sizeof(Account), 1, fp)
function exportJSON() {
  if (!currentAccount) return;
  const data = JSON.stringify(currentAccount, null, 2);
  downloadFile(data, `${currentAccount.accNo}_account.json`, "application/json");
  showToast("JSON file downloaded — account struct exported!", "info");
}

// CSV export — C: fprintf(fp, "%s,%s,%.2f\n", type, date, amount)
function exportCSV() {
  if (!currentAccount) return;
  const rows = [
    "Txn#,Date,Time,Type,Remark,Amount (INR),Balance After (INR)",
    ...currentAccount.transactions.map((t, i) => {
      const d   = new Date(t.datetime);
      const date = d.toLocaleDateString("en-IN");
      const time = d.toLocaleTimeString("en-IN");
      return `${i+1},${date},${time},${t.type},"${t.remark}",${t.amount.toFixed(2)},${t.balanceAfter.toFixed(2)}`;
    })
  ];
  downloadFile(rows.join("\n"), `${currentAccount.accNo}_transactions.csv`, "text/csv");
  showToast("CSV file downloaded — fprintf() row-by-row!", "info");
}

// TXT statement — C: fputs(statement, fp)
function exportTXT() {
  if (!currentAccount) return;
  const a   = currentAccount;
  const sep = "─".repeat(60);
  const lines = [
    "╔══════════════════════════════════════════════════════════╗",
    "║              NEXVAULT PRIVATE BANK — STATEMENT           ║",
    "╚══════════════════════════════════════════════════════════╝",
    "",
    `  Account Number : ${a.accNo}`,
    `  Account Holder : ${a.name}`,
    `  Email          : ${a.email}`,
    `  Account Opened : ${new Date(a.openedAt).toLocaleString("en-IN")}`,
    `  Current Balance: ₹${a.balance.toFixed(2)}`,
    "",
    sep,
    "  TRANSACTION HISTORY",
    sep,
    `  ${"#".padEnd(4)} ${"Type".padEnd(12)} ${"Amount".padEnd(14)} ${"Balance".padEnd(14)} Remark`,
    sep,
    ...a.transactions.map((t, i) =>
      `  ${String(i+1).padEnd(4)} ${t.type.padEnd(12)} ₹${t.amount.toFixed(2).padEnd(12)} ₹${t.balanceAfter.toFixed(2).padEnd(12)} ${t.remark}`
    ),
    sep,
    "",
    `  Total Deposits   : ₹${a.totalDeposited.toFixed(2)}`,
    `  Total Withdrawals: ₹${a.totalWithdrawn.toFixed(2)}`,
    `  Net Balance      : ₹${a.balance.toFixed(2)}`,
    "",
    `  Generated on: ${new Date().toLocaleString("en-IN")}`,
    "  NexVault Bank — All rights reserved.",
  ];
  downloadFile(lines.join("\n"), `${a.accNo}_statement.txt`, "text/plain");
  showToast("Statement downloaded — fwrite() text export!", "info");
}

/* ───────────────────────────────────────────────────
   UI HELPERS
   ─────────────────────────────────────────────────── */
const fmt    = n  => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDt  = dt => new Date(dt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const $      = id => document.getElementById(id);
const cls    = (el, ...c) => el && el.classList.add(...c);
const rmCls  = (el, ...c) => el && el.classList.remove(...c);

let toastTimer;
function showToast(msg, type = "info") {
  const t = $("toast");
  t.textContent = msg;
  t.className   = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast hidden"; }, 3600);
}

function showResult(id, msg, ok) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className   = `result-box ${ok ? "success-box" : "error-box"}`;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => rmCls(s, "active"));
  cls($(id), "active");
}

function showPanel(id) {
  document.querySelectorAll(".panel").forEach(p => rmCls(p, "active"));
  cls($(id), "active");
  document.querySelectorAll(".nav-item").forEach(n => rmCls(n, "active"));
  const btn = document.querySelector(`.nav-item[data-panel="${id}"]`);
  if (btn) cls(btn, "active");

  if (id === "panel-enquiry")  refreshEnquiry();
  if (id === "panel-history")  refreshHistory();
  if (id === "panel-overview") refreshOverview();
}

/* ───────────────────────────────────────────────────
   REFRESH PANELS
   ─────────────────────────────────────────────────── */
function refreshOverview() {
  if (!currentAccount) return;
  const a = currentAccount;
  $("ov-name").textContent        = a.name.split(" ")[0];
  $("ov-balance").textContent     = `₹${fmt(a.balance)}`;
  $("ov-deposits").textContent    = `₹${fmt(a.totalDeposited)}`;
  $("ov-withdrawals").textContent = `₹${fmt(a.totalWithdrawn)}`;

  const list = $("ov-txn-list");
  const last5 = [...a.transactions].reverse().slice(0, 5);
  if (!last5.length) { list.innerHTML = `<p class="empty-msg">No transactions yet.</p>`; return; }
  list.innerHTML = last5.map(t => txnRowHTML(t)).join("");
}

function txnRowHTML(t) {
  const cls2 = t.type === "deposit" ? "dep" : "wdr";
  const sign  = t.type === "deposit" ? "+" : "−";
  return `
  <div class="txn-row">
    <div class="txn-badge ${cls2}">${t.type === "deposit" ? "↑" : "↓"}</div>
    <div class="txn-meta">
      <span class="txn-type">${t.remark}</span>
      <span class="txn-date">${fmtDt(t.datetime)}</span>
    </div>
    <span class="txn-amt ${cls2}">${sign}₹${fmt(t.amount)}</span>
  </div>`;
}

function refreshEnquiry() {
  if (!currentAccount) return;
  const a = currentAccount;
  $("enq-acc").textContent    = a.accNo;
  $("enq-name").textContent   = a.name;
  $("enq-email").textContent  = a.email;
  $("enq-opened").textContent = fmtDt(a.openedAt);
  $("enq-balance").textContent= `₹${fmt(a.balance)}`;
  $("enq-txns").textContent   = a.transactions.length;
}

function refreshHistory(filter = "all", query = "") {
  if (!currentAccount) return;
  let txns = [...currentAccount.transactions].reverse();
  if (filter !== "all")  txns = txns.filter(t => t.type === filter);
  if (query.trim())      txns = txns.filter(t =>
    t.remark.toLowerCase().includes(query.toLowerCase()) ||
    t.type.toLowerCase().includes(query.toLowerCase())
  );

  const tbody = $("history-tbody");
  const empty = $("history-empty");
  if (!txns.length) { tbody.innerHTML = ""; rmCls(empty, "hidden"); return; }
  cls(empty, "hidden");

  tbody.innerHTML = txns.map((t, i) => {
    const isDep = t.type === "deposit";
    return `<tr>
      <td>${currentAccount.transactions.length - i}</td>
      <td>${fmtDt(t.datetime)}</td>
      <td><span class="${isDep ? "type-dep" : "type-wdr"}">${t.type}</span></td>
      <td>${t.remark}</td>
      <td class="${isDep ? "amt-dep" : "amt-wdr"}">${isDep ? "+" : "−"}₹${fmt(t.amount)}</td>
      <td>₹${fmt(t.balanceAfter)}</td>
    </tr>`;
  }).join("");
}

function refreshSidebar() {
  if (!currentAccount) return;
  $("sb-name").textContent  = currentAccount.name;
  $("sb-acc").textContent   = currentAccount.accNo;
  $("sb-avatar").textContent= currentAccount.name[0].toUpperCase();
}

/* ───────────────────────────────────────────────────
   AUTH — Register
   ─────────────────────────────────────────────────── */
$("btn-register").addEventListener("click", () => {
  const name    = $("reg-name").value.trim();
  const email   = $("reg-email").value.trim();
  const deposit = parseFloat($("reg-deposit").value);
  const pin     = $("reg-pin").value.trim();
  const msg     = $("reg-msg");

  msg.className = "form-msg";

  if (!name)                    { msg.textContent = "Please enter your full name."; msg.className = "form-msg error"; return; }
  if (!email || !email.includes("@")) { msg.textContent = "Enter a valid email address."; msg.className = "form-msg error"; return; }
  if (isNaN(deposit) || deposit < 500) { msg.textContent = "Minimum initial deposit is ₹500."; msg.className = "form-msg error"; return; }
  if (!/^\d{4}$/.test(pin))    { msg.textContent = "PIN must be exactly 4 digits."; msg.className = "form-msg error"; return; }

  const acc = createAccount(name, email, deposit, pin);
  accountDB.set(acc.accNo, acc);

  msg.className   = "form-msg success";
  msg.textContent = `✓ Account created! Your number: ${acc.accNo}`;

  // Clear fields
  ["reg-name","reg-email","reg-deposit","reg-pin"].forEach(id => $(id).value = "");
  showToast(`Welcome, ${name}! Account ${acc.accNo} created.`, "success");
});

/* ───────────────────────────────────────────────────
   AUTH — Login
   ─────────────────────────────────────────────────── */
$("btn-login").addEventListener("click", () => {
  const accNo = $("login-acc").value.trim().toUpperCase();
  const pin   = $("login-pin").value.trim();
  const msg   = $("login-msg");
  msg.className = "form-msg";

  if (!accNo || !pin) { msg.textContent = "Please fill all fields."; msg.className = "form-msg error"; return; }
  const acc = accountDB.get(accNo);
  if (!acc)           { msg.textContent = "Account not found."; msg.className = "form-msg error"; return; }
  if (acc.pin !== pin){ msg.textContent = "Incorrect PIN."; msg.className = "form-msg error"; return; }

  currentAccount = acc;
  ["login-acc","login-pin"].forEach(id => $(id).value = "");
  msg.textContent = "";

  showScreen("dashboard-screen");
  showPanel("panel-overview");
  refreshSidebar();
  refreshOverview();
  showToast(`Signed in as ${acc.name}`, "success");
});

/* ───────────────────────────────────────────────────
   DEPOSIT
   ─────────────────────────────────────────────────── */
$("btn-deposit").addEventListener("click", () => {
  const amount = parseFloat($("dep-amount").value);
  const remark = $("dep-remark").value.trim() || "Deposit";
  const result = deposit(currentAccount, amount, remark);
  showResult("dep-result", result.msg, result.ok);
  if (result.ok) {
    $("dep-amount").value = "";
    $("dep-remark").value = "";
    showToast(result.msg, "success");
    refreshSidebar();
  } else {
    showToast(result.msg, "error");
  }
});

/* ───────────────────────────────────────────────────
   WITHDRAW
   ─────────────────────────────────────────────────── */
$("btn-withdraw").addEventListener("click", () => {
  const amount = parseFloat($("wdr-amount").value);
  const remark = $("wdr-remark").value.trim() || "Withdrawal";
  const result = withdraw(currentAccount, amount, remark);
  showResult("wdr-result", result.msg, result.ok);
  if (result.ok) {
    $("wdr-amount").value = "";
    $("wdr-remark").value = "";
    showToast(result.msg, "success");
    refreshSidebar();
  } else {
    showToast(result.msg, "error");
  }
});

/* ───────────────────────────────────────────────────
   NAV — Tab & Panel Routing
   ─────────────────────────────────────────────────── */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => rmCls(b, "active"));
    document.querySelectorAll(".tab-content").forEach(c => rmCls(c, "active"));
    cls(btn, "active");
    cls($(`tab-${btn.dataset.tab}`), "active");
  });
});

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => showPanel(btn.dataset.panel));
});

/* ───────────────────────────────────────────────────
   SEARCH & FILTER (Transaction History)
   ─────────────────────────────────────────────────── */
$("txn-search").addEventListener("input",  e => refreshHistory($("txn-filter").value, e.target.value));
$("txn-filter").addEventListener("change", e => refreshHistory(e.target.value, $("txn-search").value));

/* ───────────────────────────────────────────────────
   EXIT SESSION  (C: fclose + program exit)
   ─────────────────────────────────────────────────── */
$("btn-exit").addEventListener("click", () => {
  rmCls($("exit-modal"), "hidden");
});
$("modal-cancel").addEventListener("click",  () => cls($("exit-modal"), "hidden"));
$("modal-confirm").addEventListener("click", () => {
  currentAccount = null;
  cls($("exit-modal"), "hidden");
  showScreen("auth-screen");
  $("login-acc").value = "";
  $("login-pin").value = "";
  $("login-msg").textContent = "";
  showToast("Session ended. Goodbye!", "info");
});

/* ───────────────────────────────────────────────────
   ANIMATED BACKGROUND (Floating Hexagons)
   ─────────────────────────────────────────────────── */
(function initCanvas() {
  const canvas = $("bg-canvas");
  const ctx    = canvas.getContext("2d");
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    particles = Array.from({ length: 28 }, () => makeParticle());
  }

  function makeParticle() {
    return {
      x    : Math.random() * (W || 1200),
      y    : Math.random() * (H || 800),
      r    : Math.random() * 28 + 10,
      vx   : (Math.random() - 0.5) * 0.3,
      vy   : (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.3 + 0.05,
    };
  }

  function hexPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
              : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -50)  p.x = W + 50;
      if (p.x > W+50) p.x = -50;
      if (p.y < -50)  p.y = H + 50;
      if (p.y > H+50) p.y = -50;
      hexPath(ctx, p.x, p.y, p.r);
      ctx.strokeStyle = `rgba(201,168,76,${p.alpha})`;
      ctx.lineWidth   = 1;
      ctx.stroke();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  draw();
})();

/* ───────────────────────────────────────────────────
   DEMO SEED — pre-load one test account for convenience
   ─────────────────────────────────────────────────── */
(function seedDemo() {
  const demo = createAccount("Arjun Sharma", "arjun@nexvault.in", 50000, "1234");
  deposit(demo,  15000, "Freelance Payment");
  deposit(demo,   8000, "Savings Transfer");
  withdraw(demo, 3500,  "Monthly Bills");
  withdraw(demo, 1200,  "Online Shopping");
  deposit(demo,  22000, "Salary Credit");
  withdraw(demo, 5000,  "Rent");
  accountDB.set(demo.accNo, demo);
  // Show hint
  console.log(`%c NexVault Demo Account `, "background:#c9a84c;color:#090e1a;font-weight:bold;padding:4px 8px;border-radius:4px;");
  console.log(`%c Account: ${demo.accNo}  |  PIN: 1234`, "color:#e2c47a;font-family:monospace;");
})();
