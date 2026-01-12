/**
 * KIKI PRO V14 - Main Application Logic
 */

let DATA = {};
let activeType = "通常";
let displayMode = "list";
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;
let isSignUpMode = false;

const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

window.onload = () => {
  silentLogin();
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  document.getElementById('work-date').value = `${y}-${m}-${day}`;
  updateDateDisplay();
};

async function silentLogin() {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');
  if (!savedID || !savedPass) {
    const loader = document.getElementById('loading');
    if(loader) loader.style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }
  try {
    authID = savedID;
    authPass = savedPass;
    const res = await callGAS("getInitialData");
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.body.classList.add('ready');
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) {
    console.error(e);
    localStorage.clear();
    document.('login-overlay').style.display = 'flex';
  }
}

async function handleAuth() {
  const nick = document.('login-nick').value;
  const pass = document.('login-pass').value;
  if (!nick || !pass) return alert("入力してください");
  try {
    const method = isSignUpMode ? "signUp" : "getInitialData";
    const res = await callGAS(method, { authID: nick, authPass: pass, nickname: nick });
    authID = nick;
    authPass = pass;
    if (document.('auto-login').checked) {
      localStorage.setItem('kiki_authID', authID);
      localStorage.setItem('kiki_authPass', authPass);
    }
    DATA = res;
    renderAll();
    document.('user-display').innerText = DATA.user.toUpperCase();
    document.body.classList.add('ready');
    document.('login-overlay').style.display = 'none';
    document.('app-content').style.display = 'flex';
  } catch (e) { alert(e.message); }
}

function renderAll() {
  try {
    const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
    const typeTabs = document.getElementById('type-tabs');
    
    if (typeTabs) {
      typeTabs.innerHTML = types.map(t => {
        const lastDate = getFinalDateByType(t);
        const splitName = t.split('').map(char => `<span>${char}</span>`).join('');
        return `
          <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
            <div class="type-name-label">${splitName}</div>
            <span class="type-last-badge">${lastDate}</span>
          </button>`;
      }).join('');
    }
    
    updateToggleAllBtnState();

    const viewWork = document.getElementById('view-work');
    const viewLog = document.getElementById('view-log');

    if (viewWork && viewWork.style.display !== 'none') {
      displayMode === 'list' ? renderList() : renderTile();
    } else if (viewLog) {
      renderLogs();
    }
    
    updateCount();
  } catch (error) {
    console.error("Render Error:", error);
    // 万が一エラーが出ても、無理やりローディングだけは消す
    const loader = document.getElementById('loading');
    if (loader) loader.style.display = 'none';
  }
}
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

function changeType(t) { 
  activeType = t; expandedZoneId = null; 
  if (!editingLogRow) selectedUnits.clear(); 
  renderAll(); 
}

function updateToggleAllBtnState() {
  const btn = document.('toggle-all-btn');
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
  let lastUnitId = -1;
  DATA.master.forEach(m => {
    if (m[tCol]) {
      const d = new Date(m[tCol]);
      if (d.getTime() === maxDate.getTime()) lastUnitId = Number(m[0]);
    }
  });
  return DATA.cols.findIndex(z => lastUnitId >= Math.min(z.s, z.e) && lastUnitId <= Math.max(z.s, z.e));
}

function fitText(text, limit) {
  if (text.length > limit) {
    const scale = limit / text.length;
    return `<span style="display:inline-block; transform:scaleX(${scale}); transform-origin:left; white-space:nowrap; width:100%;">${text}</span>`;
  }
  return `<span>${text}</span>`;
}

/**
 * リスト表示描画
 */
function renderList() {
  const container = document.('zone-display');
  container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  container.innerHTML = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  ).map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const bgColor = (z.color || z.bg) && (z.color || z.bg) !== "" ? (z.color || z.bg) : "#ffffff";

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="padding:15px; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:15px;">
            <div onclick="handleZoneCheck(event, ${originalIdx})">
              <input type="checkbox" ${isAll ? 'checked' : ''} style="transform:scale(1.8); pointer-events:none;">
            </div>
            <div>
              <div class="list-zone-name">${z.name}</div>
              <div class="list-range-no f-oswald">No.${z.s} - ${z.e}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="list-date-top f-oswald">${formatLastDate(z, originalIdx === finalIdx)}</div>
            <div class="list-count-bottom f-oswald">${selCount}<span style="font-size:16px; opacity:0.6;">/${zoneUnits.length}</span></div>
          </div>
        </div>
        <div class="status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <h3 class="expand-title">${z.name}</h3>
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">完了</button>
        </div>
      </div>`;
  }).join('');
}

/**
 * タイル表示描画
 */
function renderTile() {
  const container = document.('zone-display');
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
    const bgColor = (z.color || z.bg) && (z.color || z.bg) !== "" ? (z.color || z.bg) : "#ffffff";
    const rawName = z.name.replace('ゾーン', '');

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row-1">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none;">
          </div>
          <div class="f-oswald">${formatLastDate(z, originalIdx === finalIdx)}</div>
        </div>
        <div class="tile-row-2"><b>${rawName.length > 5 ? fitText(rawName, 5) : rawName}</b></div>
        <div class="tile-row-3 f-oswald">No.${z.s}-${z.e}</div>
        <div class="tile-row-4 f-oswald">${selCount}<small style="font-size:10px; opacity:0.7;">/${zoneUnits.length}</small></div>
        <div class="tile-row-5 status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <h3 class="expand-title">${z.name}</h3>
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">完了</button>
        </div>
      </div>`;
  }).join('');
}

function handleZoneAction(event, index) {
  if (event.target.type === 'checkbox' || event.target.closest('.check-wrapper')) return;
  if (event.target.closest('.expand-box')) return;
  event.stopPropagation();
  expandedZoneId = (expandedZoneId === index) ? null : index;
  displayMode === 'list' ? renderList() : renderTile();
}

function closeExpand(e) {
  e.stopPropagation();
  expandedZoneId = null;
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
  document.('u-total').innerText = count;
  document.('send-btn').disabled = (count === 0);
  document.('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function updateDateDisplay() {
  const val = document.('work-date').value;
  if (!val) return;
  const d = new Date(val);
  const days = ["日","月","火","水","木","金","土"];
  document.('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function setMode(m) { 
  displayMode = m; 
  document.('mode-list-btn').classList.toggle('active', m === 'list'); 
  document.('mode-tile-btn').classList.toggle('active', m === 'tile'); 
  renderAll(); 
}

function switchView(v) {
  const isWork = (v === 'work');
  document.('view-work').style.display = isWork ? 'block' : 'none';
  document.('view-log').style.display = isWork ? 'none' : 'block';
  document.('view-mode-controls').style.display = isWork ? 'flex' : 'none';
  document.('footer-content-wrap').style.display = isWork ? 'block' : 'none';
  document.('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function formatLastDate(z, isFinal = false) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const dateStr = `${last.getMonth() + 1}/${last.getDate()}(${days[last.getDay()]})`;
  return isFinal ? `<span style="color:red; font-weight:900;">🚩${dateStr}</span>` : dateStr;
}

function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return;
  const target = document.(`zone-card-${finalIdx}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.transform = "scale(1.05)";
    setTimeout(() => target.style.transform = "", 300);
  }
}

async function upload() {
  if (selectedUnits.size === 0) return;
  try {
    await callGAS("addNewRecord", { 
      date: document.('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    const reloadPromise = silentLogin();
    cancelEdit(); 
    switchView('log');
    await reloadPromise;
  } catch (e) { alert("通信エラーが発生しました"); }
}

function cancelEdit() { 
  editingLogRow = null; selectedUnits.clear(); expandedZoneId = null; 
  renderAll(); 
}

function renderLogs() {
  const filtered = DATA.logs.filter(l => l.type === activeType);
  document.('log-list').innerHTML = filtered.map(l => {
    const ids = l.ids ? String(l.ids).split(',').map(Number).sort((a,b)=>a-b) : [];
    const rangeStr = ids.length > 0 ? `${ids[0]}～${ids[ids.length-1]}` : '---';
    let dateWithDay = l.date;
    try {
      const d = new Date(l.date.replace(/\//g, '-'));
      const days = ["日","月","火","水","木","金","土"];
      dateWithDay += `(${days[d.getDay()]})`;
    } catch(e) {}
    return `
    <div class="log-card">
      <div class="log-date-badge">${l.type} - ${dateWithDay}</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-end; color:#fff;">
        <div>
          <div class="log-main-info" style="font-size:18px; font-weight:900;">${l.zone}</div>
          <div class="f-oswald log-range">No.${rangeStr}</div>
          <div style="font-size:11px; opacity:0.6;">登録者: ${l.user}</div>
        </div>
        <div class="log-unit-large">${l.count}<small style="font-size:12px;">台</small></div>
      </div>
      <div class="log-action-row">
        <button class="btn-log-edit shadow-blue" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')">編集</button>
        <button class="btn-log-del shadow-red" onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:120px;"></div>`;
}

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  const idStr = ids ? String(ids) : "";
  selectedUnits = new Set(idStr.split(',').filter(x => x.trim() !== "").map(Number));
  activeType = type;
  if (date) document.('work-date').value = date.replace(/\//g, '-');
  updateDateDisplay(); 
  displayMode = 'tile';
  switchView('work');
  renderAll();
}

async function handleDelete(row) { 
  if (confirm("この履歴を削除しますか？")) { 
    try { await callGAS("deleteLog", { row }); await silentLogin(); } 
    catch (e) { alert("エラーが発生しました"); }
  } 
}

function showQR() { 
  const target = document.("qr-target"); 
  if (!target) return;
  target.innerHTML = ""; 
  new QRCode(target, { text: window.location.href, width: 200, height: 200 }); 
  document.("qr-overlay").style.display = "flex"; 
}
function hideQR() { document.("qr-overlay").style.display = "none"; }
function showManual() { document.('manual-overlay').style.display = 'flex'; }
function hideManual() { document.('manual-overlay').style.display = 'none'; }
function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN";
  document.getElementById('auth-submit').innerText = isSignUpMode ? "REGISTER & LOGIN" : "LOGIN";
}
