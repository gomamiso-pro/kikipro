const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwqFK7wEVWGSDOdgokNVTM5soWfKKLkKEVuQtM-18H_JEZlNmtjQVuvaAmNuxps4ekXwQ/exec";
let DATA = {}, activeType = "通常", displayMode = "list", selectedUnits = new Set(), expandedZoneId = null, editingLogRow = null, authID = "", authPass = "";

const TYPE_MAP = { "通常":3, "セル盤":4, "計数機":5, "ユニット":6, "説明書":7 };
const DATE_COL_MAP = { "通常":8, "セル盤":9, "計数機":10, "ユニット":11, "説明書":12 };

window.onload = () => {
  const savedID = localStorage.getItem('kiki_authID'), savedPass = localStorage.getItem('kiki_authPass');
  if (savedID && savedPass) { authID = savedID; authPass = savedPass; silentLogin(); } 
  else { document.getElementById('login-overlay').style.display = 'flex'; document.getElementById('loading').style.display = 'none'; }
  const d = new Date();
  document.getElementById('work-date').value = d.toISOString().split('T')[0];
  document.getElementById('work-date').addEventListener('change', updateDateDisplay);
  updateDateDisplay();
};

async function silentLogin() {
  document.getElementById('loading').style.display = 'flex';
  try {
    const res = await callGAS("getInitialData");
    if (res.status === "error") { localStorage.clear(); location.reload(); return false; }
    document.getElementById('login-overlay').style.display = 'none';
    DATA = res; document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    return true;
  } finally { document.getElementById('loading').style.display = 'none'; }
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

function renderList() {
  const container = document.getElementById('zone-display'); container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType], finalIdx = getFinalWorkZoneIndex();
  const activeZones = DATA.cols.filter(z => DATA.master.some(m => Number(m[0]) >= Math.min(z.s,z.e) && Number(m[0]) <= Math.max(z.s,z.e) && Number(m[tIdx]) === 1));

  container.innerHTML = activeZones.map(z => {
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s,z.e) && Number(m[0]) <= Math.max(z.s,z.e));
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const originalIdx = DATA.cols.indexOf(z);
    const isAll = zoneUnits.every(m => selectedUnits.has(Number(m[0])));

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="zone-flex">
          <div class="zone-check-area" onclick="handleZoneCheck(event, ${z.s}, ${z.e})"><input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none;"></div>
          <div class="zone-main-content" style="background:${z.bg}; color:#000; flex:1; padding:10px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; font-family:'Oswald'; align-items: center;">
              <b>${z.name}</b><span style="font-size:16px; font-weight:900;">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:5px;">
              <span class="f-oswald" style="font-size:20px;">No.${z.s}-${z.e}</span><span class="f-oswald" style="font-weight:700;">${selCount}/${zoneUnits.length}台</span>
            </div>
          </div>
        </div>
        <div class="progress-container status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(50px, 1fr)); gap:4px; margin-top:10px;">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display'); container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType], finalIdx = getFinalWorkZoneIndex();
  const activeZones = DATA.cols.filter(z => DATA.master.some(m => Number(m[0]) >= Math.min(z.s,z.e) && Number(m[0]) <= Math.max(z.s,z.e) && Number(m[tIdx]) === 1));

  container.innerHTML = activeZones.map(z => {
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s,z.e) && Number(m[0]) <= Math.max(z.s,z.e));
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const originalIdx = DATA.cols.indexOf(z);
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''}" style="background:${z.bg}; color:#000;" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div onclick="handleZoneCheck(event, ${z.s}, ${z.e})"><input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none;"></div>
          <span style="font-size:11px; font-weight:900; font-family:'Oswald';">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}</span>
        </div>
        <div style="font-weight:900; font-size:9px;">${z.name.replace('ゾーン', '')}</div>
        <div class="f-oswald" style="text-align:left; font-weight:700;">${z.s}-${z.e}</div>
        <div style="text-align:right; font-family:'Oswald'; font-size:10px;">${selCount}/${zoneUnits.length}台</div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
      </div>`;
  }).join('');
}

function updateCount() {
  const count = selectedUnits.size; document.getElementById('u-total').innerText = count;
  const sendBtn = document.getElementById('send-btn'), cancelBtn = document.getElementById('cancel-btn'), toggleAllBtn = document.getElementById('toggle-all-btn');
  sendBtn.disabled = (count === 0); sendBtn.innerText = editingLogRow ? "修正を保存" : "登録実行";
  
  if (toggleAllBtn) {
    const tIdx = TYPE_MAP[activeType];
    const allIds = DATA.master.filter(m => Number(m[tIdx])===1).map(m=>Number(m[0]));
    const isAll = allIds.length > 0 && allIds.every(id => selectedUnits.has(id));
    toggleAllBtn.innerText = isAll ? "全解除" : "全選択";
    isAll ? toggleAllBtn.classList.add('is-all') : toggleAllBtn.classList.remove('is-all');
  }
  cancelBtn.style.display = (count > 0 || editingLogRow) ? "block" : "none";
  cancelBtn.innerText = editingLogRow ? "編集を中止" : "選択を解除";
}

async function upload() {
  if (selectedUnits.size === 0) return;
  document.getElementById('loading').style.display = 'flex';
  try {
    await callGAS("addNewRecord", { date: document.getElementById('work-date').value, type: activeType, ids: Array.from(selectedUnits), editRow: editingLogRow });
    selectedUnits.clear(); editingLogRow = null; await silentLogin(); switchView('log');
  } catch (e) { alert("登録エラー"); } finally { document.getElementById('loading').style.display = 'none'; }
}

function updateDateDisplay() {
  const d = new Date(document.getElementById('work-date').value);
  const dayStr = ["日","月","火","水","木","金","土"][d.getDay()];
  document.getElementById('date-label').innerText = `${d.getMonth()+1}/${d.getDate()}(${dayStr})`;
}

function changeType(t) { activeType = t; expandedZoneId = null; if(!editingLogRow) selectedUnits.clear(); renderAll(); }
function handleZoneAction(e, idx) { e.stopPropagation(); expandedZoneId = (expandedZoneId === idx) ? null : idx; renderAll(); }
function handleZoneCheck(e, s, eNum) {
  e.stopPropagation();
  const zoneIds = DATA.master.filter(m => Number(m[0]) >= Math.min(s, eNum) && Number(m[0]) <= Math.max(s, eNum)).map(m => Number(m[0]));
  zoneIds.every(id => selectedUnits.has(id)) ? zoneIds.forEach(id => selectedUnits.delete(id)) : zoneIds.forEach(id => selectedUnits.add(id));
  renderAll();
}
function toggleUnit(id) { selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id); renderAll(); }
function toggleAllSelection() {
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx])===1).map(m=>Number(m[0]));
  allIds.every(id=>selectedUnits.has(id)) ? selectedUnits.clear() : allIds.forEach(id=>selectedUnits.add(id));
  renderAll();
}
function switchView(v) {
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}
function formatLastDate(z) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0])>=Math.min(z.s,z.e) && Number(m[0])<=Math.max(z.s,z.e));
  let last = null; units.forEach(m => { if(m[tCol]) { const d = new Date(m[tCol]); if(!last || d > last) last = d; } });
  if(!last) return "未";
  return `${last.getMonth()+1}/${last.getDate()}`;
}
function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType]; let last=null, maxId=-1;
  DATA.master.forEach(m => { if(m[tCol]) { const d=new Date(m[tCol]); if(!last || d>last) { last=d; maxId=Number(m[0]); } } });
  return DATA.cols.findIndex(z => maxId>=Math.min(z.s,z.e) && maxId<=Math.max(z.s,z.e));
}
function logout() { if(confirm("ログアウトしますか？")) { localStorage.clear(); location.reload(); } }
function showQR() {
  const target = document.getElementById("qr-target"); target.innerHTML = "";
  new QRCode(target, { text: window.location.href, width: 180, height: 180 });
  document.getElementById("qr-overlay").style.display = "flex";
}
function hideQR() { document.getElementById("qr-overlay").style.display = "none"; }
function setMode(m) { displayMode = m; renderAll(); }
function cancelEdit() { editingLogRow = null; selectedUnits.clear(); renderAll(); }
function renderLogs() {
  const filtered = DATA.logs.filter(l => l.type === activeType);
  document.getElementById('log-list').innerHTML = filtered.map(l => `
    <div style="background:var(--card); padding:15px; margin-bottom:10px; border-radius:10px; border-left:5px solid var(--accent);">
      <div style="font-size:11px; color:var(--text-dim);">${l.date} (${l.day}) - ${l.user}</div>
      <div style="display:flex; justify-content:space-between; margin-top:5px; align-items: center;">
        <div style="font-weight:900;">${l.zone} (No.${l.s}-${l.e})</div>
        <div class="log-unit-badge">${l.count}台</div>
      </div>
      <div style="text-align:right; margin-top:15px;"><span class="btn-edit" onclick="startEdit(${l.row},'${l.ids}','${l.date}')">編集</span><span class="btn-delete" onclick="handleDelete(${l.row})">削除</span></div>
    </div>`).join('');
}
function startEdit(row, ids, date) { editingLogRow=row; selectedUnits=new Set(ids.split(',').map(Number)); document.getElementById('work-date').value=date.replace(/\//g,'-'); updateDateDisplay(); switchView('work'); }
async function handleDelete(row) { if(confirm("削除？")) { document.getElementById('loading').style.display='flex'; await callGAS("deleteLog",{row}); await silentLogin(); } }
