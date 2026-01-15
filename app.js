/**
 * KIKI PRO V17 - Total Optimized App Logic
 * 爆速通信同期 / Loading制御 / 2026 Stable
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

// 列インデックス設定 (マスタシートの構成に準拠)
const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

// --- 2. 初期起動処理 ---
window.onload = () => {
  silentLogin(); 
  const d = new Date();
  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dateInput.value = `${y}-${m}-${day}`;
    updateDateDisplay();
  }
};

// --- 3. 認証・データ取得コア ---
async function silentLogin() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';

  if (!authID || !authPass) {
    hideLoader();
    if (overlay) overlay.style.display = 'flex';
    return;
  }

  try {
    // api.jsのcallGASがLoadingを表示してくれる
    const res = await callGAS("getInitialData", { authID, authPass });
    DATA = res;
    completeLogin();
  } catch (e) {
    console.error("Silent Login Failed:", e);
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
    if (overlay) overlay.style.display = 'flex';
  } finally {
    hideLoader();
  }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  if (!nick || !pass) return alert("入力してください");

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
    completeLogin();
    document.getElementById('login-overlay').style.display = 'none';
  } catch (e) {
    // エラー表示はapi.jsで完結
  } finally {
    hideLoader();
  }
}

function completeLogin() {
  const userDisp = document.getElementById('user-display');
  if (userDisp) userDisp.innerText = DATA.user.toUpperCase();
  document.body.classList.add('ready');
  document.getElementById('app-content').style.display = 'flex';
  renderAll();
}

// --- 4. 通信アクション (爆速同期仕様) ---
async function upload() {
  if (selectedUnits.size === 0) return;

  try {
    // V17仕様: addNewRecordの戻り値に最新のDATAが含まれている
    const res = await callGAS("addNewRecord", { 
      authID, authPass, // 認証維持用
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    
    DATA = res; // 1回の通信で更新データを反映
    cancelEdit(); 
    switchView('log'); // 履歴画面へ
  } catch (e) { 
    alert("保存に失敗しました");
  } finally {
    hideLoader();
  }
}

async function handleDelete(row) { 
  if (!confirm("この履歴を削除しますか？")) return;

  try { 
    // V17仕様: deleteLogの戻り値に最新のDATAが含まれている
    const res = await callGAS("deleteLog", { authID, authPass, row }); 
    DATA = res; 
    renderAll();
  } catch (e) {
    alert("削除に失敗しました");
  } finally {
    hideLoader();
  }
}

// --- 5. 描画ロジック ---
function renderAll() {
  if (!DATA || !DATA.cols) return;

  // タブの更新
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  const tabContainer = document.getElementById('type-tabs');
  if (tabContainer) {
    tabContainer.innerHTML = types.map(t => `
      <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
        ${t}<span class="type-last-badge">${getFinalDateByType(t)}</span>
      </button>`).join('');
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
  if (!container) return;
  container.className = "zone-container-list"; 
  
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  container.innerHTML = DATA.cols.map((z, originalIdx) => {
    // 該当タイプの台だけ抽出
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    if (zoneUnits.length === 0) return ""; // 該当台がないゾーンは非表示

    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="display:flex; width:100%; align-items: stretch;">
          <div class="zone-check-area" onclick="handleZoneCheck(event, ${originalIdx})" style="width: 60px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.03);">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="transform: scale(1.8); pointer-events: none;">
          </div>
          <div style="background:${z.color || '#fff'}; flex:1; padding: 12px 15px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b style="font-size:15px;">${z.name}</b>
              <span class="f-oswald" style="font-size:13px; font-weight:700; color:${isFinalZone ? '#d32f2f' : '#666'};">
                ${isFinalZone ? '🚩' : ''}${formatLastDate(z)}
              </span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:5px;">
              <span class="f-oswald" style="font-size:22px; font-weight:900;">No.${z.s}-${z.e}</span>
              <div class="f-oswald"><span style="font-size:22px; font-weight:900;">${selCount}</span><small>/${zoneUnits.length}</small></div>
            </div>
          </div>
        </div>
        <div class="status-bar-bg" style="height:6px; display:flex;">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" style="flex:1;"></div>`).join('')}
        </div>
        ${renderExpandBox(zoneUnits, originalIdx)}
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
    if (zoneUnits.length === 0) return "";

    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" style="background-color:${z.color || "#fff"} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row-1">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})"><input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none;"></div>
          <div class="tile-date-box ${isFinalZone ? 'is-final' : ''}">${isFinalZone ? '🚩' : ''}${formatLastDate(z, true)}</div>
        </div>
        <div class="tile-row-2"><b>${getFitSpan(z.name.replace('ゾーン',''), 16, 70)}</b></div>
        <div class="tile-row-3 f-oswald">${getFitSpan(`No.${z.s}-${z.e}`, 14, 75)}</div>
        <div class="tile-row-4 f-oswald"><b>${selCount}</b><small>/${zoneUnits.length}</small></div>
        <div class="tile-row-5 status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        ${renderExpandBox(zoneUnits, originalIdx)}
      </div>`;
  }).join('');
}

function renderExpandBox(units, idx) {
  return `
    <div class="expand-box" style="display: ${expandedZoneId === idx ? 'block' : 'none'};" onclick="event.stopPropagation()">
      <div class="unit-grid">
        ${units.map(m => `
          <div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">
            ${m[0]}
          </div>`).join('')}
      </div>
      <button class="btn-close-expand" onclick="closeExpand(event)">完了</button>
    </div>`;
}

// --- 6. ユーティリティ・コントロール ---
function handleZoneAction(event, index) {
  if (event.target.type === 'checkbox' || event.target.closest('.check-wrapper') || event.target.closest('.expand-box')) return;
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
  renderAll();
}

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = (count === 0);
  document.getElementById('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function changeType(t) { 
  activeType = t; 
  expandedZoneId = null; 
  if (!editingLogRow) selectedUnits.clear(); 
  renderAll(); 
}

function switchView(v) {
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('view-mode-controls').style.display = isWork ? 'flex' : 'none';
  document.getElementById('footer-content-wrap').style.display = isWork ? 'block' : 'none';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  const logList = document.getElementById('log-list');
  if(!logList) return;

  logList.innerHTML = filtered.map(l => `
    <div class="log-card">
      <div class="log-date-badge">${l.type} - ${l.date}</div>
      <div class="log-content">
        <div>
          <div class="f-oswald log-zone-name">${l.zone}</div>
          <div class="f-oswald log-range">No.${l.s}～${l.e}</div>
          <div class="log-user">👤 ${l.user || '---'}</div>
        </div>
        <div class="log-unit-large">${l.count}<small>台</small></div>
      </div>
      <div class="log-action-row">
        <button class="btn-log-edit" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')">編集</button>
        <button class="btn-log-del" onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`).join('') + `<div style="height:150px;"></div>`;
}

// 最終作業日取得ヘルパー
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
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}`;
}

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  selectedUnits = new Set(String(ids).split(',').filter(x => x).map(Number));
  activeType = type;
  if (date) document.getElementById('work-date').value = date.replace(/\//g, '-');
  updateDateDisplay(); 
  switchView('work');
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); renderAll(); }
function closeExpand(e) { e.stopPropagation(); expandedZoneId = null; renderAll(); }
function setMode(m) { displayMode = m; renderAll(); }
function toggleAuthMode() { isSignUpMode = !isSignUpMode; handleAuthModeUI(); }

function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  const targetEl = document.getElementById(`zone-card-${finalIdx}`);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetEl.classList.add('jump-highlight');
    setTimeout(() => targetEl.classList.remove('jump-highlight'), 1600);
  }
}

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val);
  document.getElementById('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
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

function getFitSpan(text, baseSize, limitWidth) {
  return `<span style="font-size:${baseSize}px;">${text}</span>`;
}
