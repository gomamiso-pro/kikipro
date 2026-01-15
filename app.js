/**
 * KIKI PRO V17 - Complete Logic
 * 全機能を維持したまま、爆速化と表示系を最適化
 */

// --- 1. グローバル変数の宣言 ---
let DATA = {};
let activeType = "通常";
let displayMode = "tile"; 
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;
let isSignUpMode = false;

// 定数
const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

// --- 2. 初期起動処理 ---
window.onload = () => {
  silentLogin(); 
  const d = new Date();
  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    dateInput.value = d.toISOString().split('T')[0];
    updateDateDisplay();
  }
};

// --- 3. 認証・データ取得コア ---
async function silentLogin() {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');

  if (!savedID || !savedPass) {
    showLogin();
    return;
  }

  try {
    // api.js経由で呼び出し
    const res = await api('getInitialData', { authID: savedID, authPass: savedPass });
    setupAppData(res, savedID, savedPass);
  } catch (e) {
    console.error("Silent Login Failed:", e);
    showLogin();
  }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  if (!nick || !pass) return alert("入力してください");

  showLoading(); // api.jsの関数
  try {
    const method = isSignUpMode ? "signUp" : "getInitialData";
    const res = await api(method, { authID: nick, authPass: pass, nickname: nick });
    
    if (document.getElementById('auto-login').checked) {
      localStorage.setItem('kiki_authID', nick);
      localStorage.setItem('kiki_authPass', pass);
    }
    setupAppData(res, nick, pass);
  } catch (e) {
    alert("認証エラー: " + e.message);
  } finally {
    hideLoading();
  }
}

function setupAppData(res, id, pass) {
  DATA = res;
  const userDisp = document.getElementById('user-display');
  if (userDisp) userDisp.innerText = DATA.user.toUpperCase();
  
  document.body.classList.remove('loading-state');
  document.body.classList.add('ready');
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-content').style.display = 'flex';
  
  renderAll();
}

function showLogin() {
  document.body.classList.remove('loading-state');
  document.getElementById('loading').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
}

function logout() {
  localStorage.removeItem('kiki_authID');
  localStorage.removeItem('kiki_authPass');
  location.reload();
}

// --- 4. 通信アクション ---
async function upload() {
  if (selectedUnits.size === 0 && !editingLogRow) return;
  showLoading();

  try {
    await api("addNewRecord", { 
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    
    // 最新データを再取得して更新
    const res = await api("getInitialData", { 
      authID: localStorage.getItem('kiki_authID'), 
      authPass: localStorage.getItem('kiki_authPass') 
    });
    DATA = res;
    cancelEdit(); 
    switchView('log');
  } catch (e) { 
    alert("保存に失敗しました: " + e.message);
  } finally {
    hideLoading();
  }
}

async function handleDelete(row) { 
  if (!confirm("この履歴を削除しますか？")) return;
  showLoading();

  try { 
    await api("deleteLog", { row }); 
    const res = await api("getInitialData", { 
      authID: localStorage.getItem('kiki_authID'), 
      authPass: localStorage.getItem('kiki_authPass') 
    });
    DATA = res;
    renderAll();
  } catch (e) {
    alert("削除に失敗しました");
  } finally {
    hideLoading();
  }
}

// --- 5. 描画ロジック ---
function renderAll() {
  if (!DATA || !DATA.cols) return;

  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  const tabContainer = document.getElementById('type-tabs');
  if (tabContainer) {
    tabContainer.innerHTML = types.map(t => {
      const lastDate = getFinalDateByType(t);
      return `
        <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
          <div class="type-name-label">${t}</div>
          <div class="type-last-badge">${lastDate}</div>
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
  const filteredZones = getFilteredZones(tIdx);

  container.innerHTML = filteredZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = getZoneUnits(z, tIdx);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''}" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:900; font-size:16px; color:#333;">${z.name}</div>
          <div class="f-oswald" style="font-size:13px; color:${isFinalZone ? '#d32f2f' : '#666'};">
            ${isFinalZone ? '🚩' : ''}${formatLastDate(z)}
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:4px;">
           <span class="f-oswald" style="font-size:20px; font-weight:900;">No.${z.s}-${z.e}</span>
           <div class="f-oswald" style="font-size:24px; font-weight:900;">${selCount}<small style="font-size:12px; opacity:0.6;">/${zoneUnits.length}</small></div>
        </div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  const filteredZones = getFilteredZones(tIdx);

  container.innerHTML = filteredZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = getZoneUnits(z, tIdx);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''}" 
           style="background-color: ${z.color || "#ffffff"} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-date-box ${isFinalZone ? 'is-final' : ''}">${isFinalZone ? '🚩' : ''}${formatLastDate(z)}</div>
        <div class="tile-row-2">${z.name.replace('ゾーン', '')}</div>
        <div class="tile-row-3 f-oswald">No.${z.s}</div>
        <div class="tile-row-4 f-oswald">${selCount}</div>
        <div class="tile-row-5 status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// --- 6. ユーティリティ ---
function getFilteredZones(tIdx) {
  return DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  );
}

function getZoneUnits(z, tIdx) {
  return DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
}

function handleZoneAction(event, index) {
  expandedZoneId = index;
  const z = DATA.cols[index];
  const tIdx = TYPE_MAP[activeType];
  const zoneUnits = getZoneUnits(z, tIdx);
  
  const overlay = document.createElement('div');
  overlay.className = 'overlay expanded';
  overlay.id = 'expand-overlay';
  overlay.innerHTML = `
    <div style="font-weight:900; margin-bottom:10px; font-size:18px; color:#000;">${z.name}</div>
    <div class="unit-grid">
      ${zoneUnits.map(m => `
        <div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" 
             onclick="toggleUnit(${Number(m[0])}, this)">
          ${m[0]}
        </div>`).join('')}
    </div>
    <button class="btn-close-expand" onclick="document.getElementById('expand-overlay').remove()">閉じる</button>
  `;
  document.body.appendChild(overlay);
}

function toggleUnit(id, el) {
  if (selectedUnits.has(id)) {
    selectedUnits.delete(id);
    if(el) el.classList.remove('active');
  } else {
    selectedUnits.add(id);
    if(el) el.classList.add('active');
  }
  updateCount();
  // 背後の描画も更新
  displayMode === 'list' ? renderList() : renderTile();
}

function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  const logList = document.getElementById('log-list');
  if(!logList) return;

  logList.innerHTML = filtered.map(l => {
    const ids = l.ids ? String(l.ids).split(',').map(Number).sort((a,b)=>a-b) : [];
    const rangeStr = ids.length > 0 ? `${ids[0]}～${ids[ids.length-1]}` : '---';
    const d = new Date(l.date);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;

    return `
    <div class="log-card">
      <div class="log-content">
        <div>
          <div class="log-main-info">${l.zone}</div>
          <div class="log-range">${dateStr} | No.${rangeStr}</div>
          <div style="font-size:11px; color:var(--text-dim); margin-top:4px;">👤 ${l.user || '---'}</div>
        </div>
        <div class="log-unit-large">${l.count}</div>
      </div>
      <div class="log-action-row">
        <button class="btn-log-edit" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')">編集</button>
        <button class="btn-log-del" onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:100px;"></div>`;
}

function getFinalDateByType(type) {
  const tCol = DATE_COL_MAP[type];
  let last = null;
  if (!DATA.master) return "未";
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}(${["日","月","火","水","木","金","土"][last.getDay()]})`;
}

function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let maxDate = null;
  if (!DATA.master || !DATA.cols) return -1;
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!maxDate || d > maxDate) maxDate = d; } });
  if (!maxDate) return -1;
  let lastId = -1;
  DATA.master.forEach(m => { if (m[tCol] && new Date(m[tCol]).getTime() === maxDate.getTime()) lastId = Number(m[0]); });
  return DATA.cols.findIndex(z => lastId >= Math.min(z.s, z.e) && lastId <= Math.max(z.s, z.e));
}

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = (count === 0 && !editingLogRow);
  document.getElementById('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function changeType(t) { activeType = t; selectedUnits.clear(); renderAll(); }

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val);
  const days = ["日","月","火","水","木","金","土"];
  document.getElementById('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function switchView(v) {
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('view-mode-controls').style.display = isWork ? 'flex' : 'none';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function formatLastDate(z) {
  const tCol = DATE_COL_MAP[activeType];
  const units = getZoneUnits(z, TYPE_MAP[activeType]);
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}(${["日","月","火","水","木","金","土"][last.getDay()]})`;
}

function setMode(m) { 
  displayMode = m; 
  document.getElementById('mode-list-btn').classList.toggle('active', m === 'list'); 
  document.getElementById('mode-tile-btn').classList.toggle('active', m === 'tile'); 
  renderAll(); 
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
  const isAll = allIds.length > 0 && allIds.every(id => selectedUnits.has(id));
  allIds.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); renderAll(); }

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  const idStr = ids ? String(ids) : "";
  selectedUnits = new Set(idStr.split(',').filter(x => x.trim() !== "").map(Number));
  activeType = type;
  if (date) document.getElementById('work-date').value = date.split(' ')[0].replace(/\//g, '-');
  updateDateDisplay(); 
  switchView('work');
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN";
  document.getElementById('auth-submit').innerText = isSignUpMode ? "REGISTER & LOGIN" : "LOGIN";
}

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
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return alert("データがありません");
  const targetEl = document.getElementById(`zone-card-${finalIdx}`);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetEl.classList.add('jump-highlight');
    setTimeout(() => targetEl.classList.remove('jump-highlight'), 1600);
  }
}
