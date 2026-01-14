/**
 * KIKI PRO V17 - Stable App Logic (Anti-Flicker & Loading Fix)
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

// 共通設定
const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

// --- 2. 初期起動処理 ---
window.onload = async () => {
  const loader = document.getElementById('loading');
  const loginOverlay = document.getElementById('login-overlay');
  const appContent = document.getElementById('app-content');

  // 初期化：まず全部隠してLoadingだけ出す
  if (loader) loader.style.display = 'flex';
  if (loginOverlay) loginOverlay.style.display = 'none';
  if (appContent) appContent.style.display = 'none';

  // 日付の初期セット
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    dateInput.value = `${y}-${m}-${day}`;
    updateDateDisplay();
  }

  // 自動ログイン判定
  if (authID && authPass) {
    // データ取得が終わるまでLoadingのまま待機
    await silentLogin();
  } else {
    // ログイン情報がないならLoadingを消してログイン画面へ
    if (loader) loader.style.display = 'none';
    if (loginOverlay) loginOverlay.style.display = 'flex';
  }
};

// --- 3. 認証・データ取得コア ---
async function silentLogin() {
  const loader = document.getElementById('loading');
  const loginOverlay = document.getElementById('login-overlay');
  const appContent = document.getElementById('app-content');

  try {
    const res = await callGAS("getInitialData");
    if (!res || res.error) throw new Error("Invalid Response");

    DATA = res;
    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = DATA.user.toUpperCase();
    
    // 描画を先に完了させる
    renderAll();
    
    // 全ての準備が整ってから画面を切り替える
    document.body.classList.add('ready');
    if (appContent) appContent.style.display = 'flex';
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (loader) loader.style.display = 'none';

  } catch (e) {
    console.error("Silent Login Failed:", e);
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
    if (loader) loader.style.display = 'none';
    if (loginOverlay) loginOverlay.style.display = 'flex';
  }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  const loader = document.getElementById('loading');
  if (!nick || !pass) return alert("入力してください");

  if (loader) loader.style.display = 'flex'; // 通信中ぐるぐる

  try {
    const method = isSignUpMode ? "signUp" : "getInitialData";
    const res = await callGAS(method, { authID: nick, authPass: pass, nickname: nick });
    
    authID = nick;
    authPass = pass;
    if (document.getElementById('auto-login').checked) {
      localStorage.setItem('kiki_authID', authID);
      localStorage.setItem('kiki_authPass', authPass);
    }
    
    DATA = res;
    const userDisp = document.getElementById('user-display');
    if (userDisp) userDisp.innerText = DATA.user.toUpperCase();
    
    renderAll();
    document.body.classList.add('ready');
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    if (loader) loader.style.display = 'none';
  } catch (e) {
    if (loader) loader.style.display = 'none';
    alert("認証に失敗しました。");
  }
}

// --- 4. 描画ロジック ---
function renderAll() {
  if (!DATA || !DATA.cols) return;

  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  const tabContainer = document.getElementById('type-tabs');
  if (tabContainer) {
    tabContainer.innerHTML = types.map(t => {
      const lastDate = getFinalDateByType(t);
      return `
        <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
          <span class="type-name-label">${t}</span>
          <span class="type-last-badge">${lastDate}</span>
        </button>`;
    }).join('');
  }
  
  updateToggleAllBtnState();
  const viewWork = document.getElementById('view-work');
  if (viewWork && viewWork.style.display !== 'none') {
    if (displayMode === 'list') {
      renderList();
    } else {
      renderTile();
    }
  } else {
    renderLogs();
  }
  updateCount();
}

function renderList() {
  const container = document.getElementById('zone-display');
  if (!container) return;
  container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();

  container.innerHTML = DATA.cols.map((z, originalIdx) => {
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    if (zoneUnits.length === 0) return '';
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''}" style="background-color: ${z.color || '#fff'} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="padding: 12px 15px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
              <input type="checkbox" ${isAll ? 'checked' : ''} style="transform: scale(1.5); pointer-events: none;">
            </div>
            <div>
              <div style="font-size: 12px; opacity: 0.6;">${z.name}</div>
              <div class="f-oswald" style="font-size: 20px; font-weight: 900;">No.${z.s} - ${z.e}</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="f-oswald" style="font-size: 13px; color: ${isFinalZone ? 'var(--danger)' : 'inherit'}">
              ${isFinalZone ? '🚩' : ''}${formatLastDate(z)}
            </div>
            <div class="f-oswald" style="font-size: 24px; font-weight: 900;">${selCount}<small>/${zoneUnits.length}</small></div>
          </div>
        </div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        <div class="expand-box" style="display: ${expandedZoneId === originalIdx ? 'block' : 'none'};" onclick="event.stopPropagation()">
          <div class="unit-grid">${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}</div>
          <button class="btn-close-expand" onclick="closeExpand(event)">完了</button>
        </div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  if (!container) return;
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  container.innerHTML = DATA.cols.map((z, originalIdx) => {
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    if (zoneUnits.length === 0) return '';
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${z.color || '#fff'} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row-1">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="transform: scale(0.8); pointer-events:none;">
          </div>
          <div class="tile-date-box">${isFinalZone ? '🚩' : ''}${formatLastDate(z)}</div>
        </div>
        <div class="tile-row-2">${getFitSpan(z.name.replace('ゾーン',''), 10, 70)}</div>
        <div class="tile-row-3">No.${z.s}-${z.e}</div>
        <div class="tile-row-4 f-oswald">${selCount}<small style="font-size:10px; opacity:0.5;">/${zoneUnits.length}</small></div>
        <div class="tile-row-5 status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <div class="unit-grid">${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}</div>
          <button class="btn-close-expand" onclick="closeExpand(event)">完了</button>
        </div>
      </div>`;
  }).join('');
}

function getFitSpan(text, baseSize, limitWidth) {
  return `<span class="tile-fit-inner" style="font-size:${baseSize}px;">${text}</span>`;
}

function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  const logList = document.getElementById('log-list');
  if(!logList) return;
  logList.innerHTML = filtered.map(l => {
    const ids = l.ids ? String(l.ids).split(',').map(Number).sort((a,b)=>a-b) : [];
    const rangeStr = ids.length > 0 ? `${ids[0]}～${ids[ids.length-1]}` : '---';
    return `
    <div class="log-card">
      <div style="font-size:11px; opacity:0.6; margin-bottom:5px;">${l.type} - ${l.date}</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-end;">
        <div>
          <div style="font-size:18px; font-weight:900; color:var(--accent);">${l.zone}</div>
          <div class="f-oswald" style="font-size:14px; opacity:0.8;">No.${rangeStr}</div>
          <div style="font-size:10px; opacity:0.5;">登録: ${l.user}</div>
        </div>
        <div class="log-unit-large">${l.count}<small style="font-size:12px;">台</small></div>
      </div>
      <div style="display:flex; gap:10px; margin-top:12px;">
        <button class="btn-log-edit" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')" style="flex:1; padding:8px; border-radius:6px; border:none;">編集</button>
        <button class="btn-log-del" onclick="handleDelete(${l.row})" style="flex:1; padding:8px; border-radius:6px; border:none;">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:150px;"></div>`;
}

// --- 5. ユーティリティ & アクション ---
function getFinalDateByType(type) {
  const tCol = DATE_COL_MAP[type];
  let last = null;
  if (!DATA.master) return "未";
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  const days = ["日","月","火","水","木","金","土"];
  return `${last.getMonth() + 1}/${last.getDate()}(${days[last.getDay()]})`;
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

function handleZoneAction(event, index) {
  if (event.target.closest('.check-wrapper') || event.target.closest('.expand-box')) return;
  expandedZoneId = (expandedZoneId === index) ? null : index;
  renderAll();
}

function handleZoneCheck(e, idx) {
  e.stopPropagation();
  const z = DATA.cols[idx];
  const tIdx = TYPE_MAP[activeType];
  const ids = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = ids.every(id => selectedUnits.has(id));
  ids.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function toggleUnit(id) {
  selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id);
  updateCount();
  displayMode === 'list' ? renderList() : renderTile();
}

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = (count === 0);
  document.getElementById('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function changeType(t) { activeType = t; expandedZoneId = null; if (!editingLogRow) selectedUnits.clear(); renderAll(); }
function closeExpand(e) { e.stopPropagation(); expandedZoneId = null; renderAll(); }

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val);
  const days = ["日","月","火","水","木","金","土"];
  const label = document.getElementById('date-label');
  if(label) label.innerText = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
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
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${last.getMonth() + 1}/${last.getDate()}(${days[last.getDay()]})`;
}

function setMode(m) { displayMode = m; document.getElementById('mode-list-btn').classList.toggle('active', m === 'list'); document.getElementById('mode-tile-btn').classList.toggle('active', m === 'tile'); renderAll(); }

function updateToggleAllBtnState() {
  const btn = document.getElementById('toggle-all-btn');
  if (!btn) return;
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = allIds.length > 0 && allIds.every(id => selectedUnits.has(id));
  btn.innerText = isAll ? "全解除" : "全選択";
  btn.classList.toggle('all-selected', isAll);
}

function handleZoneCheckAll() {
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = allIds.every(id => selectedUnits.has(id));
  allIds.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

async function upload() {
  const loader = document.getElementById('loading');
  if (selectedUnits.size === 0) return;
  if (loader) loader.style.display = 'flex';
  try {
    await callGAS("addNewRecord", { date: document.getElementById('work-date').value, type: activeType, ids: Array.from(selectedUnits), editRow: editingLogRow });
    await silentLogin();
    cancelEdit();
    switchView('log');
  } catch (e) {
    if (loader) loader.style.display = 'none';
  }
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); expandedZoneId = null; renderAll(); }

function startEdit(row, ids, date, type) {
  editingLogRow = row;
  selectedUnits = new Set(String(ids).split(',').filter(x => x).map(Number));
  activeType = type;
  if (date) document.getElementById('work-date').value = date.replace(/\//g, '-');
  updateDateDisplay();
  switchView('work');
}

async function handleDelete(row) {
  if (confirm("削除しますか？")) {
    const loader = document.getElementById('loading');
    if (loader) loader.style.display = 'flex';
    try {
      await callGAS("deleteLog", { row });
      await silentLogin();
    } catch (e) {
      if (loader) loader.style.display = 'none';
    }
  }
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN";
  document.getElementById('auth-submit').innerText = isSignUpMode ? "REGISTER" : "LOGIN";
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
  if (finalIdx === -1) return alert("データなし");
  const targetEl = document.getElementById(`zone-card-${finalIdx}`);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetEl.classList.add('jump-highlight');
    setTimeout(() => targetEl.classList.remove('jump-highlight'), 1600);
  }
}

function logout() {
  if(confirm("ログアウトしますか？")) {
    localStorage.clear();
    location.reload();
  }
}
