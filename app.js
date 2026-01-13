/**
 * KIKI PRO V15 - Complete Stable App Logic (Bug Fixed)
 */

// --- 1. グローバル変数の宣言 ---
let authID = localStorage.getItem('kiki_authID') || "";
let authPass = localStorage.getItem('kiki_authPass') || "";
let DATA = {};
let activeType = "通常";
let displayMode = "tile"; // 初期モードをエラーの起きにくい tile に設定
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;
let isSignUpMode = false;

// 共通設定
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
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.style.display = 'flex';
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
  } catch (e) {
    console.error("Silent Login Failed:", e);
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
  } catch (e) {
    // api.js側でエラー処理がされている想定
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
          ${t}<span class="type-last-badge">${lastDate}</span>
        </button>`;
    }).join('');
  }
  
  updateToggleAllBtnState();
  const viewWork = document.getElementById('view-work');
  if (viewWork && viewWork.style.display !== 'none') {
    // renderListがないことによるエラーを防ぐため、存在チェックを入れる
    if (displayMode === 'list' && typeof renderList === 'function') {
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
  // 最新の作業があった「一番最後のゾーンインデックス」を取得
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

    // 🚩を表示するかどうかの判定
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" 
           class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important; margin-bottom: 10px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 2px 4px rgba(0,0,0,0.05);" 
           onclick="handleZoneAction(event, ${originalIdx})">
        
        <div style="padding: 12px 15px; display: flex; align-items: center; justify-content: space-between;">
          
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})" style="display: flex; align-items: center; padding: 5px;">
              <input type="checkbox" ${isAll ? 'checked' : ''} style="transform: scale(1.6); pointer-events: none;">
            </div>
            <div style="line-height: 1.1;">
              <div style="font-size: 14px; font-weight: 700; color: #666; margin-bottom: 2px;">${z.name}</div>
              <div class="f-oswald" style="font-size: 24px; font-weight: 900; color: #000; letter-spacing: -0.5px;">
                No.${z.s} <span style="font-size:16px; opacity:0.5;">-</span> ${z.e}
              </div>
            </div>
          </div>

          <div style="text-align: right; min-width: 110px; display: flex; flex-direction: column; justify-content: center; gap: 4px;">
            <div class="f-oswald" style="font-size: 14px; font-weight: 800; color: ${isFinalZone ? '#d32f2f' : '#555'}; background: ${isFinalZone ? 'rgba(211,47,47,0.1)' : 'transparent'}; padding: 3px 6px; border-radius: 4px; display: inline-block; margin-left: auto;">
              ${isFinalZone ? '🚩 ' : ''}${formatLastDate(z)}
            </div>
            <div class="f-oswald" style="font-size: 28px; font-weight: 900; color: #000; line-height: 1;">
              ${selCount}<span style="font-size: 14px; opacity: 0.6; font-weight: 700; margin-left: 2px;">/ ${zoneUnits.length}</span>
            </div>
          </div>
        </div>

        <div class="status-bar-bg" style="height: 8px; background: rgba(0,0,0,0.08); display: flex;">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" style="flex:1; height:100%; border-right: 0.5px solid rgba(255,255,255,0.2);"></div>`).join('')}
        </div>

        <div class="expand-box" style="display: ${expandedZoneId === originalIdx ? 'block' : 'none'}; padding: 12px; background: rgba(255,255,255,0.6);" onclick="event.stopPropagation()">
          <div class="unit-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 8px;">
            ${zoneUnits.map(m => `
              <div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" 
                   style="padding: 12px 0; text-align: center; border-radius: 6px; font-size: 18px; font-weight: 900; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                   onclick="toggleUnit(${Number(m[0])})">
                ${m[0]}
              </div>`).join('')}
          </div>
          <button class="btn-close-expand" 
                  style="width: 100%; margin-top: 12px; padding: 12px; border-radius: 8px; border: none; background: #333; color: white; font-weight: 900; font-size: 16px;"
                  onclick="closeExpand(event)">完了</button>
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
    const bgColor = z.color || "#ffffff";
    const rawName = z.name.replace('ゾーン', '');
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important; padding: 4px 2px;" onclick="handleZoneAction(event, ${originalIdx})">
        
        <div class="tile-row-1" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2px;">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none; transform: scale(0.75);">
          </div>
          <div class="tile-date-box ${isFinalZone ? 'is-final' : ''}">
            ${isFinalZone ? '🚩' : ''}${formatLastDate(z, true)}
          </div>
        </div>
        
        <div class="tile-row-2" style="text-align: left; padding-left: 3px; font-weight: 800; height: 21px; overflow: visible;">
          <b>${getFitSpan(rawName, 19, 70)}</b>
        </div>
        
        <div class="tile-row-3 f-oswald" style="text-align: left; padding-left: 1px; color: #000 !important; font-weight: 700; height: 21px; overflow: visible;">
          ${getFitSpan(`No.${z.s}-${z.e}`, 19, 75)}
        </div>
        
        <div class="tile-row-4 f-oswald" style="text-align: right; padding-right: 4px; margin-top: 2px;">
          <span style="font-size: 18px; font-weight: 900;">${selCount}</span><small style="font-size:9px; opacity:0.7;">/${zoneUnits.length}</small>
        </div>

        <div class="tile-row-5 status-bar-bg" style="margin-top: 4px; margin-left: 1px; margin-right: 1px;">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>

        <div class="expand-box" onclick="event.stopPropagation()">
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">完了</button>
        </div>
      </div>`;
  }).join('');
}

function getFitSpan(text, baseSize, limitWidth) {
  let estimatedWidth = 0;
  for (let char of String(text)) {
    estimatedWidth += char.match(/[ -~]/) ? baseSize * 0.52 : baseSize;
  }
  const scale = estimatedWidth > limitWidth ? limitWidth / estimatedWidth : 1;
  return `<span class="tile-fit-inner" style="
      font-size:${baseSize}px; 
      transform:scaleX(${scale}); 
      transform-origin: left; 
      display: inline-block; 
      white-space: nowrap;
      letter-spacing: -0.3px; 
    ">${text}</span>`;
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
      <div class="log-date-badge">${l.type} - ${l.date}</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-end;">
        <div>
          <div class="log-main-info" style="font-size:18px; font-weight:900; color:var(--accent);">${l.zone}</div>
          <div class="f-oswald log-range">No.${rangeStr}</div>
          <div style="font-size:11px; opacity:0.6;">登録者: ${l.user}</div>
        </div>
        <div class="log-unit-large">${l.count}<small style="font-size:12px;">台</small></div>
      </div>
      <div class="log-action-row" style="display:flex; gap:12px; margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;">
        <button class="btn-log-edit shadow-blue" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')" style="flex:1;">編集</button>
        <button class="btn-log-del shadow-red" onclick="handleDelete(${l.row})" style="flex:1;">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:120px;"></div>`;
}

// --- 5. ユーティリティ & アクション ---
function getFinalDateByType(type) {
  const tCol = DATE_COL_MAP[type];
  let last = null;
  if (!DATA.master) return "未";
  DATA.master.forEach(m => {
    if (m[tCol]) {
      const d = new Date(m[tCol]);
      if (!last || d > last) last = d;
    }
  });
  if (!last) return "未";
  const days = ["日","月","火","水","木","金","土"];
  return `${last.getMonth() + 1}/${last.getDate()}(${days[last.getDay()]})`;
}

function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let maxDate = null;
  if (!DATA.master || !DATA.cols) return -1;
  DATA.master.forEach(m => {
    if (m[tCol]) {
      const d = new Date(m[tCol]);
      if (!maxDate || d > maxDate) maxDate = d;
    }
  });
  if (!maxDate) return -1;
  let lastId = -1;
  DATA.master.forEach(m => {
    if (m[tCol] && new Date(m[tCol]).getTime() === maxDate.getTime()) lastId = Number(m[0]);
  });
  return DATA.cols.findIndex(z => lastId >= Math.min(z.s, z.e) && lastId <= Math.max(z.s, z.e));
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
  if (displayMode === 'list') {
      renderList();
  } else {
      renderTile();
  }
}

function updateCount() {
  const count = selectedUnits.size;
  const countEl = document.getElementById('u-total');
  if (countEl) countEl.innerText = count;
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = (count === 0);
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) cancelBtn.style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function changeType(t) { 
  activeType = t; 
  expandedZoneId = null; 
  if (!editingLogRow) selectedUnits.clear(); 
  renderAll(); 
}

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
  document.getElementById('footer-content-wrap').style.display = isWork ? 'block' : 'none';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function formatLastDate(z, isShort = false) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${last.getMonth() + 1}/${last.getDate()}(${days[last.getDay()]})`;
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
  if (selectedUnits.size === 0) return;
  try {
    await callGAS("addNewRecord", { 
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    await silentLogin();
    cancelEdit(); 
    switchView('log');
  } catch (e) { }
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); expandedZoneId = null; renderAll(); }

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  const idStr = ids ? String(ids) : "";
  selectedUnits = new Set(idStr.split(',').filter(x => x.trim() !== "").map(Number));
  activeType = type;
  if (date) document.getElementById('work-date').value = date.replace(/\//g, '-');
  updateDateDisplay(); 
  displayMode = 'tile';
  switchView('work');
  renderAll();
}

async function handleDelete(row) { 
  if (confirm("この履歴を削除しますか？")) { 
    try { 
      await callGAS("deleteLog", { row }); 
      await silentLogin(); 
    } catch (e) {}
  } 
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN";
  document.getElementById('auth-submit').innerText = isSignUpMode ? "REGISTER & LOGIN" : "LOGIN";
}

function showQR() { 
  const target = document.getElementById("qr-target"); 
  if (!target) return;
  target.innerHTML = ""; 
  new QRCode(target, { text: window.location.href, width: 200, height: 200 }); 
  document.getElementById("qr-overlay").style.display = "flex"; 
}
function hideQR() { document.getElementById("qr-overlay").style.display = "none"; }
function showManual() { document.getElementById('manual-overlay').style.display = 'flex'; }
function hideManual() { document.getElementById('m
