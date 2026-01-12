/**
 * KIKI PRO V15 - App Logic
 */

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

window.onload = () => {
  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    const d = new Date();
    dateInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    updateDateDisplay();
  }
  // 認証情報の有無で初期画面を分岐
  if (authID && authPass) { 
    silentLogin(); 
  } else { 
    showLoginOverlay(); 
  }
};

function showLoginOverlay() {
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'none';
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'flex';
}

async function silentLogin() {
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
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
    showLoginOverlay();
  }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  if (!nick || !pass) return alert("ニックネームとパスワードを入力してください");
  
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
    // エラーメッセージは callGAS 内で表示されます
  }
}

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
  if (!container) return;
  container.className = "zone-container-list"; 
  const tIdx = TYPE_MAP[activeType];
  
  const filteredZones = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  );

  container.innerHTML = filteredZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${z.color || '#ffffff'} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="zone-row-inner">
          <div class="zone-info-left">
            <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
              <input type="checkbox" ${isAll ? 'checked' : ''}>
            </div>
            <div class="zone-name-block">
              <div class="zone-name-sub">${z.name}</div>
              <div class="zone-no-main f-oswald">No.${z.s} - ${z.e}</div>
            </div>
          </div>
          <div class="zone-info-right">
            <div class="zone-count-main f-oswald">${selCount}<span class="zone-count-total">/ ${zoneUnits.length}</span></div>
          </div>
        </div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        ${generateExpandBoxHTML(z, zoneUnits, originalIdx)}
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  if (!container) return;
  container.className = "zone-container-tile";
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
    const rawName = z.name.replace('ゾーン', '');
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${z.color || '#ffffff'} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row-1">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none;">
          </div>
          <div class="tile-date-box ${isFinalZone ? 'is-final' : ''}">${isFinalZone ? '🚩' : ''}${formatLastDate(z)}</div>
        </div>
        <div class="tile-row-2">${getFitSpan(rawName, 9, 85)}</div>
        <div class="tile-row-3 f-oswald">
          <span class="tile-no-label">No.</span>
          <span class="tile-main-number">${z.s}-${z.e}</span>
        </div>
        <div class="tile-row-4 f-oswald"><span>${selCount}</span><small>/${zoneUnits.length}</small></div>
        <div class="tile-row-5 status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        ${generateExpandBoxHTML(z, zoneUnits, originalIdx)}
      </div>`;
  }).join('');
}

function generateExpandBoxHTML(z, zoneUnits, originalIdx) {
  return `
    <div class="expand-box" style="display: ${expandedZoneId === originalIdx ? 'flex' : 'none'};" onclick="event.stopPropagation()">
      <div class="expand-header">
        <div class="expand-title-main">${z.name}</div>
        <div class="expand-title-sub f-oswald">No.${z.s} - ${z.e}</div>
      </div>
      <div class="unit-grid">
        ${zoneUnits.map(m => `
          <div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" 
               onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>
        `).join('')}
      </div>
      <button class="btn-close-expand" onclick="closeExpand(event)">入力を完了する</button>
    </div>
  `;
}

function getFitSpan(text, baseSize, limitWidth) {
  let estimatedWidth = 0;
  for (let char of String(text)) { estimatedWidth += char.match(/[ -~]/) ? baseSize * 0.52 : baseSize; }
  const scale = estimatedWidth > limitWidth ? limitWidth / estimatedWidth : 1;
  return `<span class="tile-fit-inner" style="transform:scaleX(${scale});">${text}</span>`;
}

function handleZoneAction(event, index) {
  if (event.target.type === 'checkbox' || event.target.closest('.check-wrapper') || event.target.closest('.unit-chip') || event.target.closest('.btn-close-expand')) return;
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
  renderAll(); 
}

function updateCount() {
  const count = selectedUnits.size;
  const totalEl = document.getElementById('u-total');
  if (totalEl) totalEl.innerText = count;
  
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

function closeExpand(e) { 
  if(e) e.stopPropagation(); 
  expandedZoneId = null; 
  renderAll(); 
}

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val); 
  const days = ["日","月","火","水","木","金","土"];
  const label = document.getElementById('date-label');
  if (label) label.innerText = `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  const logList = document.getElementById('log-list');
  if(!logList) return;
  
  logList.innerHTML = filtered.length ? filtered.map(l => {
    const ids = l.ids ? String(l.ids).split(',').map(Number).sort((a,b)=>a-b) : [];
    const rangeStr = ids.length > 0 ? `${ids[0]}～${ids[ids.length-1]}` : '---';
    return `
    <div class="log-card">
      <div class="log-date-badge">${l.type} - ${l.date}</div>
      <div class="log-card-body">
        <div>
          <div class="log-zone-name">${l.zone}</div>
          <div class="log-no-range f-oswald">No.${rangeStr}</div>
        </div>
        <div class="log-unit-large">${l.count}<small>台</small></div>
      </div>
      <div class="log-action-row">
        <button class="btn-log-edit" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')">編集</button>
        <button class="btn-log-del" onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`;
  }).join('') : `<div style="padding:40px; text-align:center; color:var(--text-dim);">履歴がありません</div>`;
}

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

function formatLastDate(z) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}`;
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

function cancelEdit() { 
  editingLogRow = null; 
  selectedUnits.clear(); 
  expandedZoneId = null; 
  renderAll(); 
}

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  selectedUnits = new Set(String(ids).split(',').filter(x => x.trim() !== "").map(Number));
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
  target.innerHTML = ""; 
  new QRCode(target, { text: window.location.href, width: 200, height: 200 }); 
  document.getElementById("qr-overlay").style.display = "flex"; 
}

function hideQR() { document.getElementById("qr-overlay").style.display = "none"; }
function showManual() { document.getElementById('manual-overlay').style.display = 'flex'; }
function hideManual() { document.getElementById('manual-overlay').style.display = 'none'; }

function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex(); 
  if (finalIdx === -1) return;
  const targetEl = document.getElementById(`zone-card-${finalIdx}`);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetEl.classList.add('jump-highlight'); 
    setTimeout(() => { targetEl.classList.remove('jump-highlight'); }, 1600);
  }
}
