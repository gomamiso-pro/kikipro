const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwqFK7wEVWGSDOdgokNVTM5soWfKKLkKEVuQtM-18H_JEZlNmtjQVuvaAmNuxps4ekXwQ/exec";

let DATA = {};
let activeType = "通常";
let displayMode = "list";
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;
let authID = "";
let authPass = "";

const TYPE_MAP = { "通常":3, "セル盤":4, "計数機":5, "ユニット":6, "説明書":7 };
const DATE_COL_MAP = { "通常":8, "セル盤":9, "計数機":10, "ユニット":11, "説明書":12 };

window.onload = () => {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');
  if (savedID && savedPass) {
    authID = savedID; authPass = savedPass;
    silentLogin();
  } else {
    document.getElementById('login-overlay').style.display = 'flex';
  }
  const d = new Date();
  document.getElementById('work-date').value = d.toISOString().split('T')[0];
  updateDateDisplay();
};

async function silentLogin() {
  document.getElementById('loading').style.display = 'flex';
  try {
    const res = await callGAS("getInitialData");
    if (res.status === "error") {
      alert(res.message); localStorage.clear();
      location.reload(); return;
    }
    document.getElementById('login-overlay').style.display = 'none';
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
  } catch (e) { alert("ログイン失敗"); }
  finally { document.getElementById('loading').style.display = 'none'; }
}

async function callGAS(method, data = {}) {
  data.authID = authID; data.authPass = authPass;
  const res = await fetch(GAS_API_URL, { method: "POST", body: JSON.stringify({ method, data }) });
  return await res.json();
}

function renderAll() {
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => `<button class="type-btn ${t===activeType?'active':''}" onclick="changeType('${t}')">${t}</button>`).join('');
  if(document.getElementById('view-work').style.display !== 'none') {
    displayMode === 'list' ? renderList() : renderTile();
  } else { renderLogs(); }
  updateCount();
}

function changeType(t) { activeType = t; expandedZoneId = null; if(!editingLogRow) selectedUnits.clear(); renderAll(); }

function handleZoneCheckAll() {
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isEverythingSelected = allIds.every(id => selectedUnits.has(id));
  if (isEverythingSelected) {
    allIds.forEach(id => selectedUnits.delete(id));
  } else {
    allIds.forEach(id => selectedUnits.add(id));
  }
  renderAll();
}

function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return;
  const target = document.getElementById(`zone-card-${finalIdx}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.outline = "4px solid var(--accent)";
    setTimeout(() => { target.style.outline = "none"; }, 2000);
  }
}

function renderList() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  const activeZones = DATA.cols.filter(z => DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1));

  container.innerHTML = activeZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAllSelected = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="display:flex; align-items:stretch; width:100%;">
          <div class="zone-check-area" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAllSelected ? 'checked' : ''} style="transform:scale(1.6); pointer-events:none;">
          </div>
          <div class="zone-main-content" style="background:${z.bg};">
            <div style="display:flex; justify-content:space-between;">
              <b>${z.name}</b>
              <span class="f-oswald" style="font-size:14px; font-weight:900;">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:5px;">
              <span class="f-oswald" style="font-size:18px;">No.${z.s}-${z.e}</span>
              <span class="f-oswald" style="font-weight:700; font-size:14px;">${selCount}/${zoneUnits.length}台</span>
            </div>
          </div>
        </div>
        <div class="status-bar-bg" style="margin:8px 12px 12px 12px;">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(60px, 1fr)); gap:8px; padding:10px;">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  const activeZones = DATA.cols.filter(z => DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1));

  container.innerHTML = activeZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAllSelected = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" style="background:${z.bg};" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row tile-row-top">
          <div onclick="handleZoneCheck(event, ${originalIdx})"><input type="checkbox" ${isAllSelected ? 'checked' : ''} style="pointer-events:none; transform:scale(0.8);"></div>
          <span>${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}</span>
        </div>
        <div class="tile-row tile-row-name">${z.name.replace('ゾーン', '')}</div>
        <div class="tile-row tile-row-no">No.${z.s}-${z.e}</div>
        <div class="tile-row tile-row-count">${selCount}/${zoneUnits.length}</div>
        <div class="status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
           <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(48px, 1fr)); gap:4px; padding:10px 4px;">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
          </div>
        </div>
      </div>`;
  }).join('');
}

function handleZoneAction(e, idx) { e.stopPropagation(); expandedZoneId = (expandedZoneId === idx) ? null : idx; renderAll(); }
function handleZoneCheck(e, idx) {
  e.stopPropagation();
  const z = DATA.cols[idx];
  const tIdx = TYPE_MAP[activeType];
  const ids = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = ids.every(id => selectedUnits.has(id));
  ids.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}
function toggleUnit(id) { selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id); renderAll(); }

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = (count === 0);
  document.getElementById('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function updateDateDisplay() {
  const d = new Date(document.getElementById('work-date').value);
  document.getElementById('date-label').innerText = `${d.getMonth()+1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
}

function setMode(m) { 
  displayMode = m; 
  document.getElementById('mode-list-btn').classList.toggle('active', m === 'list');
  document.getElementById('mode-tile-btn').classList.toggle('active', m === 'tile');
  renderAll(); 
}

function switchView(v) {
  const isWork = (v === 'work');
  if (selectedUnits.size > 0 || editingLogRow) cancelEdit();
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = !isWork ? 'block' : 'none';
  document.getElementById('view-mode-controls').style.display = isWork ? 'block' : 'none';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function formatLastDate(z) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0])>=Math.min(z.s,z.e) && Number(m[0])<=Math.max(z.s,z.e));
  let last = null;
  units.forEach(m => { if(m[tCol]) { const d = new Date(m[tCol]); if(!last || d > last) last = d; } });
  if(!last) return "未";
  const days = ["日","月","火","水","木","金","土"];
  return `${last.getMonth()+1}/${last.getDate()}(${days[last.getDay()]})`;
}

function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let last=null, maxId=-1;
  DATA.master.forEach(m => { if(m[tCol]) { const d=new Date(m[tCol]); if(!last || d>last) { last=d; maxId=Number(m[0]); } } });
  return DATA.cols.findIndex(z => maxId>=Math.min(z.s,z.e) && maxId<=Math.max(z.s,z.e));
}

async function upload() {
  if (selectedUnits.size === 0) return;
  document.getElementById('loading').style.display = 'flex';
  try {
    await callGAS("addNewRecord", { date: document.getElementById('work-date').value, type: activeType, ids: Array.from(selectedUnits), editRow: editingLogRow });
    cancelEdit(); await silentLogin(); switchView('log');
  } catch(e) { alert("エラー"); } finally { document.getElementById('loading').style.display = 'none'; }
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); expandedZoneId = null; renderAll(); }

function renderLogs() {
  const filtered = DATA.logs.filter(l => l.type === activeType);
  document.getElementById('log-list').innerHTML = filtered.map(l => `
    <div style="background:var(--card); padding:15px; margin:10px; border-radius:10px; border-left:5px solid var(--accent);">
      <div style="font-size:11px; color:var(--text-dim);">${l.date} (${l.day}) - ${l.user}</div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-weight:900; font-size:15px;">${l.zone} (No.${l.s}-${l.e})</div>
        <div class="log-unit-badge">${l.count}</div>
      </div>
      <div style="text-align:right; margin-top:10px; font-size:12px;">
        <span onclick="startEdit(${l.row},'${l.ids}','${l.date}')" style="color:var(--accent); margin-right:15px; font-weight:bold;">編集</span>
        <span onclick="handleDelete(${l.row})" style="color:var(--danger); font-weight:bold;">削除</span>
      </div>
    </div>`).join('') + `<div style="height:200px;"></div>`;
}

function startEdit(row, ids, date) { editingLogRow = row; selectedUnits = new Set(ids.split(',').map(Number)); document.getElementById('work-date').value = date.replace(/\//g,'-'); updateDateDisplay(); switchView('work'); }
async function handleDelete(row) { if(confirm("削除？")) { document.getElementById('loading').style.display='flex'; await callGAS("deleteLog",{row}); await silentLogin(); } }
function showQR() {
  const target = document.getElementById("qr-target");
  target.innerHTML = "";
  new QRCode(target, { text: window.location.href, width: 200, height: 200 });
  document.getElementById("qr-overlay").style.display = "flex";
}
function hideQR() { document.getElementById("qr-overlay").style.display = "none"; }
function logout() { localStorage.clear(); location.reload(); }
