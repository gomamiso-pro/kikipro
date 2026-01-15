/** KIKI PRO V17 - TRUE FULL CODE **/
let authID = localStorage.getItem('kiki_authID') || "";
let authPass = localStorage.getItem('kiki_authPass') || "";
let DATA = {};
let activeType = "通常";
let displayMode = "tile"; 
let selectedUnits = new Set();
let editingLogRow = null;

const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

window.onload = () => {
  if (authID && authPass) silentLogin();
  else showLogin();
  
  const d = new Date();
  document.getElementById('work-date').value = d.toISOString().split('T')[0];
  updateDateDisplay();
};

function showLogin() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
}

async function silentLogin() {
  try {
    DATA = await callGAS("getInitialData", { authID, authPass });
    initApp();
  } catch (e) { showLogin(); }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  if (!nick || !pass) return alert("入力してください");

  // ログインボタン押下後、即座にLoadingを表示
  document.getElementById('loading').style.display = 'flex';

  try {
    DATA = await callGAS("getInitialData", { authID: nick, authPass: pass });
    authID = nick; authPass = pass;
    localStorage.setItem('kiki_authID', authID);
    localStorage.setItem('kiki_authPass', authPass);
    initApp();
  } catch (e) { 
    document.getElementById('loading').style.display = 'none';
  }
}

function initApp() {
  document.getElementById('user-display').innerText = DATA.user.toUpperCase();
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-content').style.display = 'flex';
  document.body.classList.add('ready');
  renderAll();
}

function renderAll() {
  if (!DATA.cols) return;

  // タイプタブの更新
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => `
    <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
      <span class="type-name-label">${t}</span>
      <span class="type-last-badge">${getFinalDateByType(t)}</span>
    </button>`).join('');

  if (document.getElementById('view-work').style.display !== 'none') {
    displayMode === 'list' ? renderList() : renderTile();
  } else {
    renderLogs();
  }
  updateCount();
}

function renderList() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType];

  container.innerHTML = DATA.cols.map((z, idx) => {
    const zoneUnits = DATA.master.filter(m => m[0] >= Math.min(z.s,z.e) && m[0] <= Math.max(z.s,z.e) && m[tIdx] === 1);
    if (zoneUnits.length === 0) return '';
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;

    return `
      <div id="zone-card-${idx}" class="card-common zone-row ${selCount > 0 ? 'has-selection' : ''}" onclick="openExpand(${idx})">
        <div class="zone-info" style="background:${z.color || '#fff'}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="font-size:16px;">${z.name}</b>
            <span class="f-oswald" style="font-size:12px;">${formatLastDate(z)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <span class="f-oswald" style="font-size:26px; font-weight:900;">No.${z.s}-${z.e}</span>
            <div class="f-oswald" style="font-size:24px;">${selCount}<small style="font-size:14px; opacity:0.6;">/${zoneUnits.length}</small></div>
          </div>
        </div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  
  container.innerHTML = DATA.cols.map((z, idx) => {
    const zoneUnits = DATA.master.filter(m => m[0] >= Math.min(z.s,z.e) && m[0] <= Math.max(z.s,z.e) && m[tIdx] === 1);
    if (zoneUnits.length === 0) return '';
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    
    return `
      <div id="zone-card-${idx}" class="card-common tile-card ${selCount > 0 ? 'has-selection' : ''}" style="background-color:${z.color || '#fff'}" onclick="openExpand(${idx})">
        <div class="f-oswald" style="font-size:8px; opacity:0.7;">${formatLastDate(z)}</div>
        <div class="tile-name">${z.name}</div>
        <div class="f-oswald" style="font-size:10px;">No.${z.s}-${z.e}</div>
        <div class="tile-count">${selCount}<small style="font-size:9px;opacity:0.5;">/${zoneUnits.length}</small></div>
        <div class="status-bar-bg" style="margin-top:auto;">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
      </div>`;
  }).join('');
}

function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  document.getElementById('log-list').innerHTML = filtered.map(l => `
    <div class="log-card">
      <div style="display:flex; justify-content:space-between;">
        <b style="font-size:18px;">${l.zone}</b>
        <span class="f-oswald">${l.date}</span>
      </div>
      <div class="f-oswald" style="font-size:28px; color:var(--accent); font-weight:900;">${l.count}台</div>
      <button class="btn-log-del" onclick="handleDelete(${l.row})">削除</button>
    </div>`).join('') + '<div style="height:100px;"></div>';
}

function openExpand(idx) {
  const z = DATA.cols[idx];
  const tIdx = TYPE_MAP[activeType];
  const units = DATA.master.filter(m => m[0] >= Math.min(z.s,z.e) && m[0] <= Math.max(z.s,z.e) && m[tIdx] === 1);
  
  document.getElementById('modal-zone-name').innerText = z.name;
  document.getElementById('modal-unit-grid').innerHTML = units.map(m => `
    <div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]}, this)">${m[0]}</div>
  `).join('');
  document.getElementById('expand-overlay').style.display = 'flex';
}

function closeExpand() {
  document.getElementById('expand-overlay').style.display = 'none';
  renderAll();
}

function toggleUnit(id, el) {
  if (selectedUnits.has(id)) {
    selectedUnits.delete(id);
    el.classList.remove('active');
  } else {
    selectedUnits.add(id);
    el.classList.add('active');
  }
  updateCount();
}

function scrollToLastWork() {
  const col = DATE_COL_MAP[activeType];
  let maxD = null, lastId = -1;
  DATA.master.forEach(m => {
    if(m[col]){
      const d = new Date(m[col]);
      if(!maxD || d > maxD){ maxD = d; lastId = m[0]; }
    }
  });
  const idx = DATA.cols.findIndex(z => lastId >= Math.min(z.s,z.e) && lastId <= Math.max(z.s,z.e));
  if (idx === -1) return;

  const target = document.getElementById(`zone-card-${idx}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('jump-highlight');
    setTimeout(() => target.classList.remove('jump-highlight'), 3000);
  }
}

async function upload() {
  if (selectedUnits.size === 0) return;
  document.getElementById('loading').style.display = 'flex';
  try {
    DATA = await callGAS("addNewRecord", { 
      authID, authPass, date: document.getElementById('work-date').value, 
      type: activeType, ids: Array.from(selectedUnits) 
    });
    selectedUnits.clear(); renderAll(); switchView('log'); 
  } catch (e) {} finally {
    document.getElementById('loading').style.display = 'none';
  }
}

async function handleDelete(row) {
  if(!confirm("削除しますか？")) return;
  document.getElementById('loading').style.display = 'flex';
  try {
    DATA = await callGAS("deleteLog", { authID, authPass, row: row });
    renderAll();
  } catch(e){} finally {
    document.getElementById('loading').style.display = 'none';
  }
}

// 共通補助関数
function changeType(t) { activeType = t; selectedUnits.clear(); renderAll(); }
function updateCount() {
  document.getElementById('u-total').innerText = selectedUnits.size;
  document.getElementById('send-btn').disabled = (selectedUnits.size === 0);
}
function updateDateDisplay() {
  const d = new Date(document.getElementById('work-date').value);
  const days = ["日","月","火","水","木","金","土"];
  document.getElementById('date-label').innerText = `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})`;
}
function switchView(v) {
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('tab-work').className = `top-tab ${isWork ? 'active-work' : ''}`;
  document.getElementById('tab-log').className = `top-tab ${!isWork ? 'active-log' : ''}`;
  renderAll();
}
function getFinalDateByType(t) {
  const col = DATE_COL_MAP[t];
  let last = null;
  DATA.master?.forEach(m => { if(m[col]){ const d=new Date(m[col]); if(!last||d>last) last=d; } });
  return last ? `${last.getMonth()+1}/${last.getDate()}` : "未";
}
function formatLastDate(z) {
  const col = DATE_COL_MAP[activeType];
  let last = null;
  DATA.master?.filter(m => m[0] >= Math.min(z.s,z.e) && m[0] <= Math.max(z.s,z.e)).forEach(m => {
    if(m[col]){ const d=new Date(m[col]); if(!last||d>last) last=d; }
  });
  return last ? `${last.getMonth()+1}/${last.getDate()}` : "未";
}
function handleZoneCheckAll() {
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => m[tIdx] === 1).map(m => m[0]);
  const isAll = allIds.every(id => selectedUnits.has(id));
  allIds.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}
