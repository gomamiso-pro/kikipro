/**
 * KIKI PRO V17 - Complete Stable App Logic
 * 共通オーバーレイ統合 & UI連動版
 */

// --- 1. グローバル変数の宣言 ---
let authID = localStorage.getItem('kiki_authID') || "";
let authPass = localStorage.getItem('kiki_authPass') || "";
let DATA = {};
let activeType = "通常";
let displayMode = "list"; 
let selectedUnits = new Set();
let editingLogRow = null;
let isSignUpMode = false;

const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

// --- 2. 初期起動処理 ---
window.onload = () => {
  silentLogin();
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    dateInput.value = `${y}-${m}-${day}`;
    updateDateDisplay();
  }
};

// --- 3. 認証・データ取得コア ---
async function silentLogin() {
  if (!authID || !authPass) {
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }
  try {
    const res = await callGAS("getInitialData");
    DATA = res;
    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = DATA.user.toUpperCase();
    renderAll();
    document.body.classList.add('ready');
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    document.getElementById('loading').style.display = 'none';
  } catch (e) {
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
    document.getElementById('login-overlay').style.display = 'flex';
  }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  if (!nick || !pass) return alert("入力してください");
  try {
    const method = isSignUpMode ? "signUp" : "getInitialData";
    const res = await callGAS(method, { authID: nick, authPass: pass, nickname: nick });
    authID = nick; authPass = pass;
    if (document.getElementById('auto-login').checked) {
      localStorage.setItem('kiki_authID', authID);
      localStorage.setItem('kiki_authPass', authPass);
    }
    DATA = res;
    renderAll();
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) {}
}

// --- 4. 描画ロジック ---
function renderAll() {
  if (!DATA || !DATA.cols) return;
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  const tabContainer = document.getElementById('type-tabs');
  if (tabContainer) {
    tabContainer.innerHTML = types.map(t => {
      const lastDate = getFinalDateByType(t);
      return `<button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
                ${t}<span class="type-last-badge">${lastDate}</span>
              </button>`;
    }).join('');
  }
  updateToggleAllBtnState();
  const viewWork = document.getElementById('view-work');
  if (viewWork && viewWork.style.display !== 'none') {
    displayMode === 'list' ? renderList() : renderTile();
  } else {
    renderLogs();
  }
  updateCount();
}

function renderList() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-list"; 
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  container.innerHTML = DATA.cols.filter(z => isVisible(z, tIdx)).map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const units = getZoneUnits(z, tIdx);
    const selCount = units.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = units.length > 0 && units.every(m => selectedUnits.has(Number(m[0])));

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''}" onclick="openExpand(${originalIdx})">
        <div class="zone-row-inner">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
              <input type="checkbox" ${isAll ? 'checked' : ''} style="transform:scale(1.6); pointer-events:none;">
            </div>
            <div>
              <div class="zone-name-sub">${z.name}</div>
              <div class="zone-no-main f-oswald">No.${z.s} - ${z.e}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="f-oswald" style="font-size:14px; font-weight:800; color:${originalIdx === finalIdx ? 'var(--danger)' : '#555'};">
              ${originalIdx === finalIdx ? '🚩 ' : ''}${formatLastDate(z)}
            </div>
            <div class="f-oswald" style="font-size:28px; font-weight:900;">
              ${selCount}<span style="font-size:14px; opacity:0.6;">/ ${units.length}</span>
            </div>
          </div>
        </div>
        <div class="status-bar-bg">
          ${units.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  container.innerHTML = DATA.cols.filter(z => isVisible(z, tIdx)).map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const units = getZoneUnits(z, tIdx);
    const selCount = units.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = units.length > 0 && units.every(m => selectedUnits.has(Number(m[0])));

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''}" onclick="openExpand(${originalIdx})">
        <div class="tile-row-1">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none; transform:scale(0.75);">
          </div>
          <div class="tile-date-box ${originalIdx === finalIdx ? 'is-final' : ''}">
            ${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}
          </div>
        </div>
        <div class="tile-row-2"><b>${z.name.replace('ゾーン','')}</b></div>
        <div class="tile-row-3 f-oswald">No.${z.s}-${z.e}</div>
        <div class="tile-row-4 f-oswald">
          <span style="font-size:18px; font-weight:900;">${selCount}</span><small style="opacity:0.7;">/${units.length}</small>
        </div>
        <div class="status-bar-bg">
          ${units.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// --- 5. 拡大表示共通ロジック ---
function openExpand(idx) {
  const z = DATA.cols[idx];
  const units = getZoneUnits(z, TYPE_MAP[activeType]);
  document.getElementById('expanded-title').innerText = `${z.name} (No.${z.s}-${z.e})`;
  document.getElementById('expanded-grid').innerHTML = units.map(m => `
    <div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">
      ${m[0]}
    </div>`).join('');
  document.getElementById('expanded-overlay').style.display = 'flex';
}

function closeExpand() {
  document.getElementById('expanded-overlay').style.display = 'none';
  renderAll();
}

function toggleUnit(id) {
  selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id);
  // オーバーレイ内のチップの色を即時更新
  const chips = document.querySelectorAll('.unit-chip');
  chips.forEach(chip => {
    if (parseInt(chip.innerText) === id) {
      chip.classList.toggle('active', selectedUnits.has(id));
    }
  });
  updateCount();
}

// --- 6. ユーティリティ ---
function getZoneUnits(z, tIdx) {
  return DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
}

function isVisible(z, tIdx) {
  return DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
}

function handleZoneCheck(e, idx) {
  e.stopPropagation();
  const z = DATA.cols[idx];
  const ids = getZoneUnits(z, TYPE_MAP[activeType]).map(m => Number(m[0]));
  const isAll = ids.every(id => selectedUnits.has(id));
  ids.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = (count === 0);
  document.getElementById('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val);
  const days = ["日","月","火","水","木","金","土"];
  document.getElementById('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function changeType(t) { activeType = t; if (!editingLogRow) selectedUnits.clear(); renderAll(); }

function switchView(v) {
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('view-mode-controls').style.display = isWork ? 'flex' : 'none';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function setMode(m) { displayMode = m; renderAll(); }

function getFinalDateByType(type) {
  const tCol = DATE_COL_MAP[type];
  let last = null;
  if (!DATA.master) return "未";
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}`;
}

function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let maxDate = null;
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!maxDate || d > maxDate) maxDate = d; } });
  if (!maxDate) return -1;
  let lastId = -1;
  DATA.master.forEach(m => { if (m[tCol] && new Date(m[tCol]).getTime() === maxDate.getTime()) lastId = Number(m[0]); });
  return DATA.cols.findIndex(z => lastId >= Math.min(z.s, z.e) && lastId <= Math.max(z.s, z.e));
}

function formatLastDate(z) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${last.getMonth() + 1}/${last.getDate()}(${days[last.getDay()]})`;
}

async function upload() {
  if (selectedUnits.size === 0) return;
  try {
    await callGAS("addNewRecord", { 
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    cancelEdit(); await silentLogin(); switchView('log');
  } catch (e) {}
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); renderAll(); }
function logout() { localStorage.clear(); location.reload(); }
function showQR() { 
  const target = document.getElementById("qr-target");
  target.innerHTML = ""; 
  new QRCode(target, { text: window.location.href, width: 200, height: 200 });
  document.getElementById("qr-overlay").style.display = "flex"; 
}
function hideQR() { document.getElementById("qr-overlay").style.display = "none"; }
function showManual() { document.getElementById('manual-overlay').style.display = 'flex'; }
function hideManual() { document.getElementById('manual-overlay').style.display = 'none'; }

function scrollToLastWork() {
  const idx = getFinalWorkZoneIndex();
  const el = document.getElementById(`zone-card-${idx}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.outline = "4px solid var(--accent)";
    setTimeout(() => { el.style.outline = "none"; }, 2000);
  }
}

function updateToggleAllBtnState() {
  const btn = document.getElementById('toggle-all-btn');
  if (!btn) return;
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = allIds.length > 0 && allIds.every(id => selectedUnits.has(id));
  btn.innerText = isAll ? "全解除" : "全選択";
}

function handleZoneCheckAll() {
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = allIds.every(id => selectedUnits.has(id));
  allIds.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}
