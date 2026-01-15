/**
 * KIKI PRO V17 - App Logic (High Performance Version)
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
    // api.js側でloaderを表示する
    DATA = await callGAS("getInitialData", { authID, authPass }); 

    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    document.body.classList.add('ready');

  } catch (e) {
    console.error("Login Error:", e);
    localStorage.clear();
    location.reload();
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  const loader = document.getElementById('loading');
  if (!nick || !pass) return alert("入力してください");

  // ボタンを押した瞬間に明示的にLoadingを表示
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
    // エラー時はapi.js側でalertが出る
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

// --- 4. 登録・削除処理 (爆速化版) ---
async function upload() {
  if (selectedUnits.size === 0) return;
  const loader = document.getElementById('loading');

  try {
    // 登録とデータ再取得を1回で行う (GAS側が最新データを返すため)
    DATA = await callGAS("addNewRecord", { 
      authID, authPass,
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    
    editingLogRow = null;
    selectedUnits.clear();
    expandedZoneId = null;
    
    renderAll(); 
    switchView('log'); 
    
    // 完了通知を少し遅らせて描画を優先
    setTimeout(() => alert("登録完了しました"), 50);

  } catch (e) { 
    // エラー処理
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

async function handleDelete(row) { 
  if (!confirm("この履歴を削除しますか？")) return;
  const loader = document.getElementById('loading');

  try { 
    DATA = await callGAS("deleteLog", { authID, authPass, row: row }); 
    renderAll();
  } catch (e) {
    // エラー処理
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
    tabContainer.innerHTML = types.map(t => {
      const lastDate = getFinalDateByType(t);
      return `
        <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
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
  if (!container) return;
  container.className = "zone-container-list"; 
  
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  const filteredZones = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  );

  container.innerHTML = filteredZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const bgColor = z.color || "#ffffff";
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="display:flex; width:100%; align-items: stretch;">
          <div class="zone-check-area" onclick="handleZoneCheck(event, ${originalIdx})" style="width: 60px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.03); border-right: 1px solid rgba(0,0,0,0.05);">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="transform: scale(1.8); pointer-events: none;">
          </div>
          <div style="background:${bgColor}; flex:1; padding: 12px 15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
              <b style="font-size:15px; color: #333;">${z.name}</b>
              <span class="f-oswald" style="font-size:13px; font-weight: 700; color: ${isFinalZone ? '#d32f2f' : '#666'};">
                ${isFinalZone ? '🚩' : ''}${formatLastDate(z)}
              </span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
              <span class="f-oswald" style="font-size:22px; font-weight: 900; letter-spacing: -0.5px;">No.${z.s}-${z.e}</span>
              <div class="f-oswald" style="text-align: right;">
                <span style="font-size:22px; font-weight: 900;">${selCount}</span>
                <span style="font-size:14px; opacity:0.6; font-weight: 700;">/${zoneUnits.length}台</span>
              </div>
            </div>
          </div>
        </div>
        <div class="status-bar-bg" style="height:6px; background: rgba(0,0,0,0.1); display: flex;">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" style="flex:1; height:100%; border-right: 0.5px solid rgba(255,255,255,0.2);"></div>`).join('')}
        </div>
        <div class="expand-box" style="display: ${expandedZoneId === originalIdx ? 'block' : 'none'};" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(70px, 1fr)); gap:10px; padding:15px; background: rgba(255,255,255,0.7);">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)" style="width: 100%; padding: 12px; background: #444; color: #fff; border: none; font-weight: 900;">完了</button>
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
  
  container.innerHTML = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  ).map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const rawName = z.name.replace('ゾーン', '');
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" style="background-color: ${z.color || "#ffffff"} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row-1">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none; transform: scale(0.75);">
          </div>
          <div class="tile-date-box ${isFinalZone ? 'is-final' : ''}">${isFinalZone ? '🚩' : ''}${formatLastDate(z, true)}</div>
        </div>
        <div class="tile-row-2"><b>${getFitSpan(rawName, 18, 70)}</b></div>
        <div class="tile-row-3 f-oswald">${getFitSpan(`No.${z.s}-${z.e}`, 18, 75)}</div>
        <div class="tile-row-4 f-oswald" style="font-size: 17px;">
          <span style="font-weight: 900;">${selCount}</span><small style="font-size:9px; opacity:0.7;">/${zoneUnits.length}</small>
        </div>
        <div class="tile-row-5 status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" style="display: ${expandedZoneId === originalIdx ? 'block' : 'none'};" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(70px, 1fr)); gap:10px; padding:15px; background: rgba(255,255,255,0.7);">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)" style="width: 100%; padding: 12px; background: #444; color: #fff; border: none; font-weight: 900;">完了</button>
        </div>
      </div>`;
  }).join('');
}

function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  const logList = document.getElementById('log-list');
  if(!logList) return;

  logList.innerHTML = filtered.map(l => {
    const ids = l.ids ? String(l.ids).split(',').map(Number).sort((a,b)=>a-b) : [];
    const rangeStr = ids.length > 0 ? `${ids[0]}～${ids[ids.length-1]}` : '---';
    const d = new Date(l.date);
    const dateWithDay = `${l.date}(${["日","月","火","水","木","金","土"][d.getDay()]})`;

    return `
    <div class="log-card" style="padding: 18px; margin-bottom: 15px;">
      <div class="log-date-badge" style="font-size: 13px; margin-bottom: 8px;">${l.type} - ${dateWithDay}</div>
      <div class="log-content" style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="f-oswald" style="font-size: 20px; font-weight: 900; color: var(--text); line-height: 1.2;">${l.zone}</div>
          <div class="f-oswald" style="font-size: 18px; font-weight: 700; color: var(--accent); margin-top: 4px;">No.${rangeStr}</div>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 8px; font-weight: 700;">👤 ${l.user || '---'}</div>
        </div>
        <div class="log-unit-large" style="text-align: right; line-height: 1;">${l.count}<small style="font-size: 14px; margin-left: 2px;">台</small></div>
      </div>
      <div class="log-action-row" style="display: flex; gap: 15px; margin-top: 15px;">
        <button class="btn-log-edit" style="flex: 2; padding: 15px; font-size: 16px; font-weight: 900; border-radius: 10px;" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')">編集</button>
        <button class="btn-log-del" style="flex: 1; padding: 15px; font-size: 16px; font-weight: 900; border-radius: 10px;" onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:150px;"></div>`;
}

// --- 6. ユーティリティ ---
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

function formatLastDate(z, isShort = false) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}(${["日", "月", "火", "水", "木", "金", "土"][last.getDay()]})`;
}

function getFitSpan(text, baseSize, limitWidth) {
  let estimatedWidth = 0;
  for (let char of String(text)) estimatedWidth += char.match(/[ -~]/) ? baseSize * 0.52 : baseSize;
  const scale = estimatedWidth > limitWidth ? limitWidth / estimatedWidth : 1;
  return `<span style="font-size:${baseSize}px; transform:scaleX(${scale}); transform-origin:left; display:inline-block; white-space:nowrap;">${text}</span>`;
}

function handleZoneAction(event, index) {
  if (event.target.type === 'checkbox' || event.target.closest('.check-wrapper') || event.target.closest('.expand-box')) return;
  event.stopPropagation();
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
  const label = document.getElementById('date-label');
  if(label) label.innerText = `${d.getMonth() + 1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
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
  const isAll = allIds.every(id => selectedUnits.has(id));
  allIds.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  const idStr = ids ? String(ids) : "";
  selectedUnits = new Set(idStr.split(',').filter(x => x.trim() !== "").map(Number));
  activeType = type;
  if (date) document.getElementById('work-date').value = date.replace(/\//g, '-');
  updateDateDisplay(); 
  displayMode = 'tile';
  switchView('work');
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); renderAll(); }
function toggleAuthMode() { isSignUpMode = !isSignUpMode; document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN"; document.getElementById('auth-submit').innerText = isSignUpMode ? "REGISTER & LOGIN" : "LOGIN"; }
function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return;
  const targetEl = document.getElementById(`zone-card-${finalIdx}`);
  if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
