/**
 * KIKI PRO V17 - Stable Logic
 */
let authID = localStorage.getItem('kiki_authID') || "";
let authPass = localStorage.getItem('kiki_authPass') || "";
let DATA = {};
let activeType = "通常";
let displayMode = "list"; 
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;

const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

window.onload = async () => {
  const d = new Date();
  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    dateInput.value = d.toISOString().split('T')[0];
    updateDateDisplay();
  }

  if (authID && authPass) {
    document.getElementById('loading').style.display = 'flex';
    await silentLogin();
  } else {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
  }
};

async function silentLogin() {
  try {
    const res = await callGAS("getInitialData");
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
  }
}

function renderAll() {
  if (!DATA || !DATA.cols) return;

  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => {
    return `<button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
              <span class="type-name-label">${t}</span>
              <span class="type-last-badge">${getFinalDateByType(t)}</span>
            </button>`;
  }).join('');
  
  updateToggleAllBtnState();
  (displayMode === 'list') ? renderList() : renderTile();
  renderLogs();
  updateCount();
}

function renderList() {
  const container = document.getElementById('zone-display');
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
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${z.color || '#fff'} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="padding: 12px 15px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
              <input type="checkbox" ${isAll ? 'checked' : ''} style="transform: scale(1.6);">
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 700; opacity: 0.7;">${z.name}</div>
              <div class="f-oswald" style="font-size: 24px; font-weight: 900;">No.${z.s}-${z.e}</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="f-oswald" style="font-size: 14px; font-weight: 800;">${isFinalZone ? '🚩 ' : ''}${formatLastDate(z)}</div>
            <div class="f-oswald" style="font-size: 28px; font-weight: 900;">${selCount}<small style="font-size:14px; opacity:0.6;">/${zoneUnits.length}</small></div>
          </div>
        </div>
        ${renderStatusBar(zoneUnits)}
        ${renderExpandBox(zoneUnits, originalIdx)}
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
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
        <div style="display:flex; justify-content:space-between; height:14px;">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="transform: scale(0.7);">
          </div>
          <div class="f-oswald" style="font-size:9px; font-weight:900;">${isFinalZone ? '🚩' : ''}${formatLastDate(z)}</div>
        </div>
        <div class="tile-row-2">${z.name.replace('ゾーン','')}</div>
        <div class="f-oswald" style="font-size:9px; opacity:0.7;">No.${z.s}-${z.e}</div>
        <div class="f-oswald" style="font-size:20px; font-weight:900; text-align:right; margin-top:auto;">
          ${selCount}<small style="font-size:10px; opacity:0.6;">/${zoneUnits.length}</small>
        </div>
        ${renderStatusBar(zoneUnits)}
        ${renderExpandBox(zoneUnits, originalIdx)}
      </div>`;
  }).join('');
}

function renderStatusBar(units) {
  return `<div class="status-bar-bg" style="display:flex; height:4px; gap:1px; margin-top:2px;">
    ${units.map(m => `<div style="flex:1; background:${selectedUnits.has(Number(m[0])) ? 'var(--accent)' : 'rgba(0,0,0,0.1)'}"></div>`).join('')}
  </div>`;
}

function renderExpandBox(units, idx) {
  return `
    <div class="expand-box" onclick="event.stopPropagation()">
      <div class="unit-grid">
        ${units.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
      </div>
      <button class="btn-close-expand" onclick="closeExpand(event)" style="width:100%; padding:15px; background:#444; color:#fff; border:none; border-radius:8px; margin-top:20px; font-weight:900;">完了</button>
    </div>`;
}

function handleZoneAction(event, index) {
  if (event.target.closest('.check-wrapper') || event.target.closest('.expand-box')) return;
  expandedZoneId = (expandedZoneId === index) ? null : index;
  renderAll();
}

function toggleUnit(id) {
  selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id);
  updateCount();
  renderAll();
}

function closeExpand(e) { e.stopPropagation(); expandedZoneId = null; renderAll(); }

function changeType(t) { activeType = t; expandedZoneId = null; if (!editingLogRow) selectedUnits.clear(); renderAll(); }

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val);
  const days = ["日","月","火","水","木","金","土"];
  document.getElementById('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = (count === 0);
  document.getElementById('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function setMode(m) { 
  displayMode = m; 
  document.getElementById('mode-list-btn').classList.toggle('active', m === 'list'); 
  document.getElementById('mode-tile-btn').classList.toggle('active', m === 'tile'); 
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

function handleZoneCheck(e, idx) {
  e.stopPropagation();
  const z = DATA.cols[idx];
  const tIdx = TYPE_MAP[activeType];
  const ids = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = ids.every(id => selectedUnits.has(id));
  ids.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function handleZoneCheckAll() {
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = allIds.every(id => selectedUnits.has(id));
  allIds.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function updateToggleAllBtnState() {
  const btn = document.getElementById('toggle-all-btn');
  if (!btn) return;
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master ? DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0])) : [];
  const isAll = allIds.length > 0 && allIds.every(id => selectedUnits.has(id));
  btn.innerText = isAll ? "全解除" : "全選択";
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
  } catch (e) { }
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); expandedZoneId = null; renderAll(); }

function switchView(v) {
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('footer-content-wrap').style.display = isWork ? 'block' : 'none';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
}

function renderLogs() {
  const logList = document.getElementById('log-list');
  if(!logList || !DATA.logs) return;
  const filtered = DATA.logs.filter(l => l.type === activeType);
  logList.innerHTML = filtered.map(l => `
    <div class="log-card" style="background:#fff; color:#000; margin:10px; padding:15px; border-radius:10px;">
      <div style="font-size:12px; opacity:0.6;">${l.date} - ${l.type}</div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
        <div style="font-size:18px; font-weight:900;">${l.zone}</div>
        <div class="f-oswald" style="font-size:24px; font-weight:900;">${l.count}台</div>
      </div>
    </div>`).join('');
}

function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return;
  const targetEl = document.getElementById(`zone-card-${finalIdx}`);
  if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
