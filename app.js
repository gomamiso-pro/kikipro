let DATA = {};
let activeType = "通常";
let displayMode = "list";
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;
let isSignUpMode = false;

const TYPE_MAP = { "通常":3, "セル盤":4, "計数機":5, "ユニット":6, "説明書":7 };
const DATE_COL_MAP = { "通常":8, "セル盤":9, "計数機":10, "ユニット":11, "説明書":12 };

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
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }

  document.getElementById('loading').style.display = 'flex';
  document.getElementById('login-overlay').style.display = 'none';

  try {
    authID = savedID;
    authPass = savedPass;
    const res = await callGAS("getInitialData", { authID, authPass });
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.body.classList.add('ready');
    document.getElementById('app-content').style.display = 'flex';
    document.getElementById('loading').style.display = 'none';
  } catch (e) {
    localStorage.clear();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
  }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  if (!nick || !pass) return alert("入力してください");
  document.getElementById('loading').style.display = 'flex';
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
    renderAll();
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    document.body.classList.add('ready');
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) { alert(e.message); }
  finally { document.getElementById('loading').style.display = 'none'; }
}

function renderAll() {
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => `<button class="type-btn ${t===activeType?'active':''}" onclick="changeType('${t}')">${t}</button>`).join('');
  updateToggleAllBtnState();
  
  if(document.getElementById('view-work').style.display !== 'none') {
    displayMode === 'list' ? renderList() : renderTile();
  } else { 
    renderLogs(); 
  }
  updateCount();
}

function changeType(t) { 
  activeType = t; 
  expandedZoneId = null; 
  if(!editingLogRow) selectedUnits.clear(); 
  renderAll(); 
}

function updateToggleAllBtnState() {
  const btn = document.getElementById('toggle-all-btn');
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
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="display:flex; width:100%;">
          <div class="zone-check-area" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="transform:scale(1.6); pointer-events:none;">
          </div>
          <div class="zone-main-content" style="background:${z.bg}; flex:1; padding:12px;">
            <div style="display:flex; justify-content:space-between;"><b>${z.name}</b><span class="f-oswald">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}</span></div>
            <div style="display:flex; justify-content:space-between; margin-top:5px;"><span class="f-oswald" style="font-size:18px;">No.${z.s}-${z.e}</span><span class="f-oswald">${selCount}/${zoneUnits.length}台</span></div>
          </div>
        </div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
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
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const isExpanded = expandedZoneId === originalIdx;
    
    const rawName = z.name.replace('ゾーン', '');
    let nScale = rawName.length > 4 ? Math.max(0.95, 4 / rawName.length) : 1;

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${isExpanded ? 'expanded' : ''}" style="background:${z.bg};" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row tile-row-top"><div onclick="handleZoneCheck(event, ${originalIdx})"><input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none; transform:scale(0.8);"></div><span class="tile-date-large">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}</span></div>
        <div class="tile-row tile-row-name"><span class="condensed-span" style="transform: scaleX(${nScale});">${rawName}</span></div>
        <div class="tile-row tile-row-no"><span class="f-oswald" style="font-size:11px;">No.${z.s}-${z.e}</span></div>
        <div class="tile-row tile-row-count f-oswald">${selCount}<span style="font-size:10px; margin:0 2px;">/</span>${zoneUnits.length}</div>
        <div class="status-bar-bg" style="height:4px;">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px; padding:6px;">
            ${zoneUnits.map(m => {
              const unitNum = Number(m[0]);
              return `<div class="unit-chip ${selectedUnits.has(unitNum) ? 'active' : ''}" onclick="toggleUnit(${unitNum})">${unitNum}</div>`;
            }).join('')}
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

function toggleUnit(id) {
  if (selectedUnits.has(id)) {
    selectedUnits.delete(id);
  } else {
    selectedUnits.add(id);
  }
  renderAll(); 
}

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = (count === 0);
  document.getElementById('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if(!val) return;
  const d = new Date(val);
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
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
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
  return `${last.getMonth()+1}/${last.getDate()}(${["日","月","火","水","木","金","土"][last.getDay()]})`;
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
    await callGAS("addNewRecord", { 
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    cancelEdit(); 
    await silentLogin(); 
    switchView('log');
  } catch(e) { alert("通信エラーが発生しました"); } 
  finally { document.getElementById('loading').style.display = 'none'; }
}

function cancelEdit() { 
  editingLogRow = null; 
  selectedUnits.clear(); 
  expandedZoneId = null; 
  renderAll(); 
}

function renderLogs() {
  const filtered = DATA.logs.filter(l => l.type === activeType);
  document.getElementById('log-list').innerHTML = filtered.map(l => {
    return `
    <div class="log-card">
      <div class="log-type-badge">${l.type}</div>
      <div class="log-sub-info">${l.date} - ${l.user}</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-end;">
        <div><div class="log-main-info">${l.zone}</div></div>
        <div class="log-unit-large">${l.count}</div>
      </div>
      <div class="log-action-row">
        <button class="btn-log-edit" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')">編集</button>
        <button class="btn-log-del" onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:200px;"></div>`;
}

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  const idStr = ids ? String(ids) : "";
  selectedUnits = new Set(idStr.split(',').filter(x => x.trim() !== "").map(Number));
  activeType = type;
  
  if (date) {
    document.getElementById('work-date').value = date.replace(/\//g, '-');
  }
  updateDateDisplay(); 

  displayMode = 'tile';
  
  document.getElementById('view-work').style.display = 'block';
  document.getElementById('view-log').style.display = 'none';
  document.getElementById('view-mode-controls').style.display = 'block';
  document.getElementById('tab-work').className = 'top-tab active-work';
  document.getElementById('tab-log').className = 'top-tab';

  document.querySelectorAll('.view-mode-bar button').forEach(b => b.classList.remove('active'));
  document.getElementById('mode-tile-btn').classList.add('active');

  renderAll();
  updateCount();
}

async function handleDelete(row) { 
  if(confirm("削除？")) { 
    document.getElementById('loading').style.display='flex'; 
    await callGAS("deleteLog",{row}); 
    await silentLogin(); 
    renderAll(); 
  } 
}

// --- 追加機能: QR・マニュアル・認証切替 ---
function showQR() { 
  const target = document.getElementById("qr-target"); 
  if(!target) return;
  target.innerHTML = ""; 
  new QRCode(target, { text: window.location.href, width: 200, height: 200 }); 
  document.getElementById("qr-overlay").style.display = "flex"; 
}
function hideQR() { document.getElementById("qr-overlay").style.display = "none"; }

function showManual() { 
  document.getElementById('manual-overlay').style.display = 'flex'; 
}
function hideManual() { document.getElementById('manual-overlay').style.display = 'none'; }

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN";
  document.getElementById('auth-submit').innerText = isSignUpMode ? "REGISTER & LOGIN" : "LOGIN";
  document.getElementById('auth-toggle-msg').innerText = isSignUpMode ? "既にアカウントをお持ちの方" : "アカウントをお持ちでない方";
  document.getElementById('auth-toggle-btn').innerText = isSignUpMode ? "ログインはこちら" : "新規登録はこちら";
}
