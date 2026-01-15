/**
 * app.js - KIKI PRO V17 Full Functional Version
 */

// --- 1. グローバル変数の宣言 ---
let authID = localStorage.getItem('kiki_authID') || "";
let authPass = localStorage.getItem('kiki_authPass') || "";
let DATA = {};
let activeType = "通常";
let displayMode = "tile"; 
let selectedUnits = new Set();
let expandedZoneId = null;
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
  const loader = document.getElementById('loading');
  if (!authID || !authPass) {
    if (loader) loader.style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }
  try {
    DATA = await callGAS("getInitialData", { authID, authPass }); 
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    document.body.classList.add('ready');
  } catch (e) {
    localStorage.clear();
    location.reload();
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

// ログインボタン押下時の処理（強制Loading表示）
async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  const loader = document.getElementById('loading');
  if (!nick || !pass) return alert("入力してください");

  // 通信開始前に強制的にLoadingを表示
  if (loader) loader.style.display = 'flex';

  try {
    const method = isSignUpMode ? "signUp" : "getInitialData";
    DATA = await callGAS(method, { authID: nick, authPass: pass, nickname: nick });
    
    authID = nick;
    authPass = pass;
    if (document.getElementById('auto-login').checked) {
      localStorage.setItem('kiki_authID', authID);
      localStorage.setItem('kiki_authPass', authPass);
    }
    
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.body.classList.add('ready');
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) {
    // api.js側でalertが出るが、ここでもloaderを消す
    if (loader) loader.style.display = 'none';
  }
}

// --- 4. 登録・削除処理 ---
async function upload() {
  if (selectedUnits.size === 0) return;
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';

  try {
    DATA = await callGAS("addNewRecord", { 
      authID, authPass,
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    editingLogRow = null;
    selectedUnits.clear();
    renderAll(); 
    switchView('log'); 
  } catch (e) {
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

async function handleDelete(row) { 
  if (!confirm("この履歴を削除しますか？")) return;
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';

  try { 
    DATA = await callGAS("deleteLog", { authID, authPass, row: row }); 
    renderAll();
  } catch (e) {
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

// --- 5. 描画・UIロジック ---
function renderAll() {
  if (!DATA || !DATA.cols) return;

  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  const tabContainer = document.getElementById('type-tabs');
  if (tabContainer) {
    tabContainer.innerHTML = types.map(t => `
      <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
        <span class="type-name-label">${t}</span>
        <span class="type-last-badge">${getFinalDateByType(t)}</span>
      </button>`).join('');
  }
  
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
  
  container.innerHTML = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  ).map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    
    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="background:${z.color || '#fff'}; padding: 12px; display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="font-size:15px;">${z.name}</b>
            <span class="f-oswald" style="font-size:12px; font-weight:700;">${formatLastDate(z)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <span class="f-oswald" style="font-size:22px; font-weight:900;">No.${z.s}-${z.e}</span>
            <div class="f-oswald">
              <span style="font-size:22px; font-weight:900;">${selCount}</span>
              <span style="font-size:14px; opacity:0.6;">/${zoneUnits.length}台</span>
            </div>
          </div>
        </div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        <div class="expand-box" style="display:${expandedZoneId === originalIdx ? 'block' : 'none'};" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(70px, 1fr)); gap:10px; padding:15px; background:rgba(255,255,255,0.7);">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)" style="width:100%; padding:15px; background:#333; color:#fff; border:none; font-weight:900;">閉じる</button>
        </div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  
  container.innerHTML = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  ).map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    
    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" style="background-color:${z.color || '#fff'} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row-1">
          <div class="tile-date-box">${formatLastDate(z)}</div>
        </div>
        <div class="tile-row-2"><b>${z.name}</b></div>
        <div class="tile-row-3 f-oswald">No.${z.s}-${z.e}</div>
        <div class="tile-row-4 f-oswald">${selCount}<small style="font-size:9px;">/${zoneUnits.length}</small></div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        <div class="expand-box" style="display:${expandedZoneId === originalIdx ? 'block' : 'none'};" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(70px, 1fr)); gap:10px; padding:15px; background:rgba(255,255,255,0.7);">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)" style="width:100%; padding:15px; background:#333; color:#fff; border:none; font-weight:900;">閉じる</button>
        </div>
      </div>`;
  }).join('');
}

function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  const logList = document.getElementById('log-list');
  if(!logList) return;

  logList.innerHTML = filtered.map(l => `
    <div class="log-card" style="padding:18px; margin-bottom:15px;">
      <div class="log-date-badge" style="font-size:13px; margin-bottom:8px;">${l.type} - ${l.date}</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div class="f-oswald" style="font-size:20px; font-weight:900;">${l.zone}</div>
          <div class="f-oswald" style="font-size:18px; color:var(--accent);">No.${l.s}～${l.e}</div>
        </div>
        <div class="log-unit-large">${l.count}<small style="font-size:14px;">台</small></div>
      </div>
      <div style="display:flex; gap:10px; margin-top:15px;">
        <button class="btn-log-del" style="flex:1; padding:12px; border-radius:10px;" onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`).join('') + `<div style="height:150px;"></div>`;
}

// --- 6. ユーティリティ ---
function getFinalDateByType(type) {
  const tCol = DATE_COL_MAP[type];
  let last = null;
  if (!DATA.master) return "未";
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  return last ? `${last.getMonth() + 1}/${last.getDate()}` : "未";
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

function formatLastDate(z) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  return last ? `${last.getMonth() + 1}/${last.getDate()}` : "未";
}

function handleZoneAction(event, index) {
  if (event.target.closest('.expand-box')) return;
  expandedZoneId = (expandedZoneId === index) ? null : index;
  renderAll();
}

function toggleUnit(id) {
  selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id);
  updateCount();
  renderAll();
}

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = (count === 0);
  document.getElementById('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function changeType(t) { activeType = t; expandedZoneId = null; selectedUnits.clear(); renderAll(); }
function closeExpand(e) { e.stopPropagation(); expandedZoneId = null; renderAll(); }

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val);
  document.getElementById('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
}

function switchView(v) {
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function setMode(m) { 
  displayMode = m; 
  document.getElementById('mode-list-btn').classList.toggle('active', m === 'list'); 
  document.getElementById('mode-tile-btn').classList.toggle('active', m === 'tile'); 
  renderAll(); 
}

function handleZoneCheckAll() {
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = allIds.every(id => selectedUnits.has(id));
  allIds.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return;
  const targetId = `zone-card-${finalIdx}`;
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetEl.classList.add('jump-highlight');
    setTimeout(() => targetEl.classList.remove('jump-highlight'), 3000);
  }
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); renderAll(); }
function toggleAuthMode() { isSignUpMode = !isSignUpMode; document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN"; }

// --- 7. マニュアル・QR等 ---
function showManual() { document.getElementById('manual-overlay').style.display = 'flex'; }
function hideManual() { document.getElementById('manual-overlay').style.display = 'none'; }
function showQR() {
  document.getElementById('qr-overlay').style.display = 'flex';
  const target = document.getElementById('qr-target');
  target.innerHTML = '';
  new QRCode(target, { text: window.location.href, width: 200, height: 200 });
}
function hideQR() { document.getElementById('qr-overlay').style.display = 'none'; }
