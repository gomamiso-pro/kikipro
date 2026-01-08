const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwqFK7wEVWGSDOdgokNVTM5soWfKKLkKEVuQtM-18H_JEZlNmtjQVuvaAmNuxps4ekXwQ/exec";

let DATA = {};
let activeType = "通常";
let displayMode = "list";
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;
let authID = "";
let authPass = "";
let isRegisterMode = false;

const TYPE_MAP = { "通常":3, "セル盤":4, "計数機":5, "ユニット":6, "説明書":7 };
const DATE_COL_MAP = { "通常":8, "セル盤":9, "計数機":10, "ユニット":11, "説明書":12 };

window.onload = () => {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');

  if (savedID && savedPass) {
    authID = savedID;
    authPass = savedPass;
    silentLogin();
  } else {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('loading').style.display = 'none';
  }

  const d = new Date();
  document.getElementById('work-date').value = d.toISOString().split('T')[0];
  updateDateDisplay();
};

// --- 認証系 ---
function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('auth-title').innerText = isRegisterMode ? "NEW REGISTER" : "KIKI LOGIN";
  document.getElementById('login-fields').style.display = isRegisterMode ? "none" : "block";
  document.getElementById('register-fields').style.display = isRegisterMode ? "block" : "none";
  document.getElementById('auth-submit').innerText = isRegisterMode ? "新規登録を実行" : "ログイン";
  document.getElementById('auth-toggle').innerText = isRegisterMode ? "ログインへ" : "新規登録";
}

async function handleAuth() {
  if (isRegisterMode) {
    const newNick = document.getElementById('reg-nick').value;
    const newID = document.getElementById('reg-id').value;
    const newPass = document.getElementById('reg-pass').value;
    if (!newNick || !newID || !newPass) return alert("全項目入力してください");
    document.getElementById('loading').style.display = 'flex';
    const res = await callGAS("registerUser", { newNick, newID, newPass, authID: "guest", authPass: "guest" });
    document.getElementById('loading').style.display = 'none';
    if (res.status === "success") { alert(res.message); toggleAuthMode(); } else { alert(res.message); }
  } else {
    authID = document.getElementById('login-id').value;
    authPass = document.getElementById('login-pass').value;
    const success = await silentLogin();
    if (success && document.getElementById('auto-login').checked) {
      localStorage.setItem('kiki_authID', authID);
      localStorage.setItem('kiki_authPass', authPass);
    }
  }
}

async function silentLogin() {
  document.getElementById('loading').style.display = 'flex';
  try {
    const res = await callGAS("getInitialData");
    if (res.status === "error") {
      alert(res.message); localStorage.clear();
      document.getElementById('loading').style.display = 'none';
      return false;
    }
    document.getElementById('login-overlay').style.display = 'none';
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.getElementById('loading').style.display = 'none';
    return true;
  } catch (e) {
    document.getElementById('loading').style.display = 'none';
    return false;
  }
}

function logout() {
  if (confirm("ログアウトしますか？")) {
    localStorage.clear();
    authID = ""; authPass = "";
    location.reload(); 
  }
}

async function callGAS(method, data = {}) {
  data.authID = authID; data.authPass = authPass;
  const res = await fetch(GAS_API_URL, { method: "POST", body: JSON.stringify({ method, data }) });
  return await res.json();
}

// --- 描画系 ---
function renderAll() {
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => `<button class="type-btn ${t===activeType?'active':''}" onclick="changeType('${t}')">${t}</button>`).join('');
  
  // 表示モードのボタンのアクティブ状態を反映
  const viewBtns = document.querySelectorAll('.view-mode-bar button');
  if(viewBtns.length >= 2) {
    viewBtns[0].className = displayMode === 'list' ? 'active' : '';
    viewBtns[1].className = displayMode === 'tile' ? 'active' : '';
  }

  if(document.getElementById('view-work').style.display !== 'none') {
    displayMode === 'list' ? renderList() : renderTile();
  } else { renderLogs(); }
  updateCount();
}

function changeType(t) { activeType = t; expandedZoneId = null; if(!editingLogRow) selectedUnits.clear(); renderAll(); }

function renderList() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();

  const activeZones = DATA.cols.filter(z => {
    return DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
  });

  container.innerHTML = activeZones.map((z) => {
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
    const zoneIds = zoneUnits.map(m => Number(m[0]));
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAllSelected = zoneIds.length > 0 && zoneIds.every(id => selectedUnits.has(id));
    const originalIdx = DATA.cols.indexOf(z);

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="zone-flex">
          <div class="zone-check-area" onclick="handleZoneCheck(event, ${z.s}, ${z.e})">
            <input type="checkbox" ${isAllSelected ? 'checked' : ''} style="pointer-events:none;">
          </div>
          <div class="zone-main-content" style="background:${z.bg}; color:#000; flex:1; padding:10px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; font-family:'Oswald'; align-items: center;">
              <b>${z.name}</b>
              <span style="font-size:16px; font-weight:900;">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:5px;">
              <span class="f-oswald" style="font-size:20px;">No.${z.s}-${z.e}</span>
              <span class="f-oswald" style="font-weight:700;">${selCount}/${zoneUnits.length}台</span>
            </div>
          </div>
        </div>
        <div class="progress-container status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(50px, 1fr)); gap:4px; margin-top:10px;">
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

  const activeZones = DATA.cols.filter(z => {
    return DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
  });

  container.innerHTML = activeZones.map((z) => {
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const originalIdx = DATA.cols.indexOf(z);
    const isAllSelected = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" style="background:${z.bg}; color:#000;" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div onclick="handleZoneCheck(event, ${z.s}, ${z.e})">
            <input type="checkbox" ${isAllSelected ? 'checked' : ''} style="pointer-events:none;">
          </div>
          <span style="font-size:11px; font-weight:900; font-family:'Oswald';">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}</span>
        </div>
        <div style="font-weight:900; font-size:9px;">${z.name.replace('ゾーン', '')}</div>
        <div class="f-oswald" style="text-align:left; font-weight:700;">No.${z.s}-${z.e}</div>
        <div style="text-align:right; font-family:'Oswald'; font-size:10px; font-weight:700;">${selCount}/${zoneUnits.length}台</div>
        <div class="progress-container status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
           <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(50px, 1fr)); gap:4px;">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" style="font-size:11px; padding:5px 0;" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
          </div>
        </div>
      </div>`;
  }).join('');
}

// --- ロジック補助 ---
function handleZoneAction(e, idx) { e.stopPropagation(); expandedZoneId = (expandedZoneId === idx) ? null : idx; renderAll(); }
function handleZoneCheck(e, s, eNum) {
  e.stopPropagation();
  const zoneIds = DATA.master.filter(m => Number(m[0]) >= Math.min(s, eNum) && Number(m[0]) <= Math.max(s, eNum)).map(m => Number(m[0]));
  const isAllSelected = zoneIds.every(id => selectedUnits.has(id));
  if (isAllSelected) { zoneIds.forEach(id => selectedUnits.delete(id)); } else { zoneIds.forEach(id => selectedUnits.add(id)); }
  renderAll();
}
function toggleUnit(id) { selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id); renderAll(); }

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  const sendBtn = document.getElementById('send-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  sendBtn.disabled = (count === 0);
  sendBtn.innerText = editingLogRow ? "修正を保存" : "登録実行";

  // 選択が0より大きい、または編集中の場合にキャンセルボタンを表示
  if (count > 0 || editingLogRow) {
    cancelBtn.style.display = "block";
    cancelBtn.className = "btn-cancel-custom"; // CSSで定義したスタイルを適用
    cancelBtn.innerText = editingLogRow ? "編集を中止" : "選択を解除";
  } else {
    cancelBtn.style.display = "none";
  }
}

function updateDateDisplay() {
  const d = new Date(document.getElementById('work-date').value);
  const dayStr = ["日","月","火","水","木","金","土"][d.getDay()];
  document.getElementById('date-label').innerText = `${d.getMonth()+1}/${d.getDate()}(${dayStr})`;
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
  if(!last) return "未入力";
  const days = ["日","月","火","水","木","金","土"];
  return `${last.getMonth()+1}/${last.getDate()}(${days[last.getDay()]})`;
}

function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let last=null, maxId=-1;
  DATA.master.forEach(m => { if(m[tCol]) { const d=new Date(m[tCol]); if(!last || d>last) { last=d; maxId=Number(m[0]); } } });
  return DATA.cols.findIndex(z => maxId>=Math.min(z.s,z.e) && maxId<=Math.max(z.s,z.e));
}

function toggleAllSelection() {
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx])===1).map(m=>Number(m[0]));
  allIds.every(id=>selectedUnits.has(id)) ? selectedUnits.clear() : allIds.forEach(id=>selectedUnits.add(id));
  renderAll();
}

function setMode(m) { displayMode = m; renderAll(); }
function closeAllDetails() { if(expandedZoneId!==null){expandedZoneId=null; renderAll();} }

async function upload() {
  if (selectedUnits.size === 0) return;
  document.getElementById('loading').style.display = 'flex';
  const res = await callGAS("addNewRecord", { date: document.getElementById('work-date').value, type: activeType, ids: Array.from(selectedUnits), editRow: editingLogRow });
  selectedUnits.clear(); editingLogRow = null; await silentLogin(); switchView('log');
}

function renderLogs() {
  const filtered = DATA.logs.filter(l => l.type === activeType);
  document.getElementById('log-list').innerHTML = filtered.map(l => `
    <div style="background:var(--card); padding:15px; margin-bottom:10px; border-radius:10px; border-left:5px solid var(--accent);">
      <div style="font-size:11px; color:var(--text-dim);">${l.date} (${l.day}) - ${l.user}</div>
      <div style="display:flex; justify-content:space-between; margin-top:5px; align-items: center;">
        <div style="font-weight:900;">${l.zone} (No.${l.s}-${l.e})</div>
        <div class="log-unit-badge">${l.count}台</div>
      </div>
      <div style="text-align:right; margin-top:15px;">
        <span class="btn-edit" onclick="startEdit(${l.row},'${l.ids}','${l.date}')">編集</span>
        <span class="btn-delete" onclick="handleDelete(${l.row})">削除</span>
      </div>
    </div>`).join('');
}

function startEdit(row, ids, date) { editingLogRow=row; selectedUnits=new Set(ids.split(',').map(Number)); document.getElementById('work-date').value=date.replace(/\//g,'-'); updateDateDisplay(); switchView('work'); }
function cancelEdit() { editingLogRow=null; selectedUnits.clear(); renderAll(); }
async function handleDelete(row) { if(confirm("削除しますか？")) { document.getElementById('loading').style.display='flex'; await callGAS("deleteLog",{row}); await silentLogin(); } }

function showQR() {
  const target = document.getElementById("qr-target");
  if (!target) return;
  target.innerHTML = "";
  new QRCode(target, { text: window.location.href, width: 180, height: 180, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H });
  document.getElementById("qr-overlay").style.display = "flex";
}

function hideQR() { document.getElementById("qr-overlay").style.display = "none"; }
