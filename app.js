/**
 * KIKI PRO V13 - Logic Optimized
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
  document.getElementById('work-date').value = d.toISOString().split('T')[0];
  updateDateDisplay();
};

async function silentLogin() {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');
  if (!savedID || !savedPass) {
    if(document.getElementById('loading')) document.getElementById('loading').style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }
  try {
    authID = savedID; authPass = savedPass;
    DATA = await callGAS("getInitialData");
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.body.classList.add('ready');
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) {
    localStorage.clear();
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
    authID = nick; authPass = pass;
    if (document.getElementById('auto-login').checked) {
      localStorage.setItem('kiki_authID', authID);
      localStorage.setItem('kiki_authPass', authPass);
    }
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) { alert(e.message); }
}

function renderAll() {
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => {
    const lastDate = getFinalDateByType(t);
    const isActive = t === activeType;
    return `
      <div class="type-tag ${isActive ? 'active' : ''}" onclick="changeType('${t}')">
        <div class="tag-label">${t}</div>
        <div class="tag-date f-oswald">${lastDate}</div>
      </div>`;
  }).join('');
  
  updateToggleAllBtnState();
  if (document.getElementById('view-work').style.display !== 'none') {
    displayMode === 'list' ? renderList() : renderTile();
  } else { renderLogs(); }
  updateCount();
}

function getFinalDateByType(type) {
  const tCol = DATE_COL_MAP[type];
  let last = null;
  if (!DATA.master) return "--/--";
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}`;
}

function changeType(t) { activeType = t; expandedZoneId = null; selectedUnits.clear(); renderAll(); }

function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let maxDate = null; let lastUnitId = -1;
  if (!DATA.master) return -1;
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!maxDate || d > maxDate) maxDate = d; } });
  if (!maxDate) return -1;
  DATA.master.forEach(m => { if (m[tCol] && new Date(m[tCol]).getTime() === maxDate.getTime()) lastUnitId = Number(m[0]); });
  return DATA.cols.findIndex(z => lastUnitId >= Math.min(z.s, z.e) && lastUnitId <= Math.max(z.s, z.e));
}

function fitText(text, limit, baseSize) {
  if (text.length > limit) {
    const scale = (limit / text.length).toFixed(2);
    return `<span style="display:inline-block; transform:scaleX(${scale}); transform-origin:left; white-space:nowrap; width:100%; font-size:${baseSize}px;">${text}</span>`;
  }
  return `<span style="font-size:${baseSize}px;">${text}</span>`;
}

function renderList() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  container.innerHTML = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  ).map((z) => {
    const idx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const isFinal = (idx === finalIdx);
    const bgColor = z.color || z.bg || "#ffffff";

    return `
      <div id="zone-card-${idx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === idx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important;" onclick="handleZoneAction(event, ${idx})">
        <div class="list-main-content">
          <div class="list-left">
            <div onclick="handleZoneCheck(event, ${idx})"><input type="checkbox" ${isAll ? 'checked' : ''} style="transform:scale(1.8);"></div>
            <div class="list-info">
              <div class="list-zone-name">${z.name}</div>
              <div class="list-no f-oswald">No.${z.s} - ${z.e}</div>
            </div>
          </div>
          <div class="list-right">
            <div class="list-date f-oswald">${isFinal ? '🚩' : ''}${formatLastDate(z)}</div>
            <div class="list-count f-oswald"><span>${selCount}</span><small>/${zoneUnits.length}</small></div>
          </div>
        </div>
        <div class="status-bar-bg" style="height:8px;">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <h3 style="font-size:22px; margin-bottom:15px; text-align:center;">${z.name} - ユニット選択</h3>
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">閉じる</button>
        </div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  container.innerHTML = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  ).map((z) => {
    const idx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const isFinal = (idx === finalIdx);
    const bgColor = z.color || z.bg || "#ffffff";
    const rawName = z.name.replace('ゾーン', '');

    return `
      <div id="zone-card-${idx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === idx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important;" onclick="handleZoneAction(event, ${idx})">
        <div class="tile-row-1 f-oswald">${isFinal ? '🚩' : ''}${formatLastDate(z)}</div>
        <div class="tile-row-2">${fitText(rawName, 5, 16)}</div>
        <div class="tile-row-3 f-oswald">${fitText(`No.${z.s}-${z.e}`, 9, 11)}</div>
        <div class="tile-row-4 f-oswald">${selCount}</div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <h3 style="font-size:22px; margin-bottom:15px; text-align:center;">${z.name}</h3>
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">閉じる</button>
        </div>
      </div>`;
  }).join('');
}

function formatLastDate(z) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";

  let globalMaxDate = null;
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!globalMaxDate || d > globalMaxDate) globalMaxDate = d; } });

  const isFinal = (globalMaxDate && last.getTime() === globalMaxDate.getTime());
  const style = isFinal ? 'class="final-date-text"' : '';
  return `<span ${style}>${last.getMonth() + 1}/${last.getDate()}</span>`;
}

function handleZoneAction(e, idx) {
  if (e.target.type === 'checkbox' || e.target.closest('.expand-box')) return;
  expandedZoneId = (expandedZoneId === idx) ? null : idx;
  renderAll();
}

function toggleUnit(id) {
  selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id);
  updateCount();
  renderAll();
}

function closeExpand(e) { e.stopPropagation(); expandedZoneId = null; renderAll(); }

function handleZoneCheck(e, idx) {
  e.stopPropagation();
  const z = DATA.cols[idx];
  const tIdx = TYPE_MAP[activeType];
  const ids = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = ids.every(id => selectedUnits.has(id));
  ids.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = (count === 0);
  document.getElementById('cancel-btn').style.display = (count > 0) ? "block" : "none";
}

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val); const days = ["日","月","火","水","木","金","土"];
  document.getElementById('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function setMode(m) { 
  displayMode = m; 
  document.getElementById('mode-list-btn').className = `switch-btn ${m==='list'?'active':''}`;
  document.getElementById('mode-tile-btn').className = `switch-btn ${m==='tile'?'active':''}`;
  renderAll(); 
}

function switchView(v) {
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('view-mode-controls').style.display = isWork ? 'flex' : 'none';
  document.getElementById('main-footer').style.display = isWork ? 'block' : 'none';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function updateToggleAllBtnState() {
  const btn = document.getElementById('toggle-all-btn'); if (!btn) return;
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
    await callGAS("addNewRecord", { date: document.getElementById('work-date').value, type: activeType, ids: Array.from(selectedUnits) });
    selectedUnits.clear();
    DATA = await callGAS("getInitialData");
    switchView('log');
  } catch (e) { alert("送信エラー"); }
}

function renderLogs() {
  const filtered = DATA.logs.filter(l => l.type === activeType);
  document.getElementById('log-list').innerHTML = filtered.map(l => `
    <div class="log-card">
      <div class="log-date-badge">${l.type} - ${l.date}</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-end;">
        <div>
          <div style="font-size:18px; font-weight:900;">${l.zone}</div>
          <div class="f-oswald" style="color:var(--accent); font-size:16px;">No.${l.ids}</div>
          <div style="font-size:11px; opacity:0.6;">登録者: ${l.user}</div>
        </div>
        <div class="log-unit-large">${l.count}<small style="font-size:12px;">台</small></div>
      </div>
    </div>`).join('') + `<div style="height:120px;"></div>`;
}

function showManual() { document.getElementById('manual-overlay').style.display='flex'; }
function hideManual() { document.getElementById('manual-overlay').style.display='none'; }
function showQR() { 
  const target = document.getElementById("qr-target"); target.innerHTML = "";
  new QRCode(target, { text: window.location.href, width: 200, height: 200 });
  document.getElementById("qr-overlay").style.display="flex"; 
}
function hideQR() { document.getElementById("qr-overlay").style.display="none"; }
function logout() { if(confirm("Logout?")){ localStorage.clear(); location.reload(); } }
function scrollToLastWork() {
  const idx = getFinalWorkZoneIndex(); if(idx===-1) return;
  const el = document.getElementById(`zone-card-${idx}`);
  if(el) el.scrollIntoView({behavior:'smooth', block:'center'});
}
