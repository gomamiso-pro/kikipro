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
    // 保存された情報がない場合は、ログイン画面を強制表示
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('loading').style.display = 'none';
  }

  const d = new Date();
  document.getElementById('work-date').value = d.toISOString().split('T')[0];
  updateDateDisplay();
};

// 認証・登録
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
    // 認証情報をクリア
    authID = "";
    authPass = "";
    // ページをリロード（これでonloadのチェックが走り、ログイン画面が出る）
    location.reload(); 
  }
}

// 共通通信
async function callGAS(method, data = {}) {
  data.authID = authID; data.authPass = authPass;
  const res = await fetch(GAS_API_URL, { method: "POST", body: JSON.stringify({ method, data }) });
  return await res.json();
}

// メイン描画系
function renderAll() {
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => `<button class="type-btn ${t===activeType?'active':''}" onclick="changeType('${t}')">${t}</button>`).join('');
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
  const finalIdx = getFinalWorkZoneIndex(); // 🚩用

  container.innerHTML = DATA.cols.map((z, i) => {
    const zoneUnits = DATA.master.filter(m => Number(m[0])>=Math.min(z.s,z.e) && Number(m[0])<=Math.max(z.s,z.e) && (Number(m[tIdx])===1 || selectedUnits.has(Number(m[0]))));
    if (zoneUnits.length === 0) return "";
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    
    return `
      <div id="zone-card-${i}" class="zone-row ${selCount>0?'has-selection':''} ${expandedZoneId===i?'expanded':''}" onclick="handleZoneAction(event, ${i})">
        <div class="zone-flex">
          <div class="zone-check-area" onclick="handleZoneCheck(event, ${z.s}, ${z.e})"><input type="checkbox" ${selCount===zoneUnits.length?'checked':''} readonly></div>
          <div class="zone-main-content" style="background:${z.bg}; color:#000;">
            <div style="display:flex; justify-content:space-between; font-family:'Oswald';">
              <b>${i===finalIdx?'🚩':''}${z.name}</b>
              <span style="font-size:12px;font-weight:900;">${formatLastDate(z)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:5px;">
              <span class="f-oswald" style="font-size:20px;">No.${z.s}-${z.e}</span>
              <span class="f-oswald">${selCount}/${zoneUnits.length}</span>
            </div>
          </div>
        </div>
        <div class="progress-container status-bar-bg">${zoneUnits.map(m=>`<div class="p-seg ${selectedUnits.has(Number(m[0]))?'active':''}"></div>`).join('')}</div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(60px, 1fr)); gap:8px;">
            ${zoneUnits.map(m=>`<div class="unit-chip ${selectedUnits.has(Number(m[0]))?'active':''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
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

  container.innerHTML = DATA.cols.map((z, i) => {
    // フィルタ条件：マスタの対象列(tIdx)が1、または現在選択中のIDであるもの（これらが黄色くなる）
    const zoneUnits = DATA.master.filter(m => 
      Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e)
    );
    const targetUnits = zoneUnits.filter(m => Number(m[tIdx]) === 1 || selectedUnits.has(Number(m[0])));
    const selCount = targetUnits.length;
    
    return `
      <div id="zone-card-${i}" class="tile-card ${selCount>0?'has-selection':''} ${expandedZoneId===i?'expanded':''}" style="background:${z.bg}; color:#000;" onclick="handleZoneAction(event, ${i})">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div onclick="handleZoneCheck(event, ${z.s}, ${z.e})"><input type="checkbox" ${selCount===zoneUnits.length?'checked':''} style="pointer-events:none;"></div>
          <span style="font-size:14px; font-weight:900; font-family:'Oswald';">${formatLastDate(z)}</span>
        </div>
        <div style="font-weight:900; font-size:11px;">${i===finalIdx?'🚩':''}${z.name.replace('ゾーン','')}</div>
        <div style="text-align:left; font-family:'Oswald'; font-weight:700; font-size:12px;">No.${z.s}-${z.e}</div>
        <div style="text-align:right; font-family:'Oswald'; font-size:10px; font-weight:700;">${selCount}/${zoneUnits.length}台</div>
        <div class="progress-container status-bar-bg">
          ${zoneUnits.map(m => {
            const isTarget = (Number(m[tIdx]) === 1 || selectedUnits.has(Number(m[0])));
            return `<div class="p-seg ${isTarget ? 'active' : ''}"></div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

// 補助ロジック
function handleZoneAction(e, idx) { e.stopPropagation(); expandedZoneId = (expandedZoneId === idx) ? null : idx; renderAll(); }
function handleZoneCheck(e, s, eNum) {
  e.stopPropagation();
  const tIdx = TYPE_MAP[activeType];
  const zIds = DATA.master.filter(m => Number(m[0])>=Math.min(s,eNum) && Number(m[0])<=Math.max(s,eNum) && Number(m[tIdx])===1).map(m=>Number(m[0]));
  zIds.every(id=>selectedUnits.has(id)) ? zIds.forEach(id=>selectedUnits.delete(id)) : zIds.forEach(id=>selectedUnits.add(id));
  renderAll();
}
function toggleUnit(id) { selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id); renderAll(); }
function updateCount() {
  document.getElementById('u-total').innerText = selectedUnits.size;
  document.getElementById('send-btn').disabled = (selectedUnits.size === 0);
  document.getElementById('send-btn').innerText = editingLogRow ? "修正を保存" : "登録実行";
  document.getElementById('cancel-btn').style.display = editingLogRow ? "block" : "none";
}
function updateDateDisplay() {
  const d = new Date(document.getElementById('work-date').value);
  document.getElementById('date-label').innerText = `${d.getMonth()+1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
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
// 日付フォーマットの修正（曜日追加）
function formatLastDate(z) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0])>=Math.min(z.s,z.e) && Number(m[0])<=Math.max(z.s,z.e));
  let last = null;
  units.forEach(m => { 
    if(m[tCol]) { 
      const d = new Date(m[tCol]); 
      if(!last || d > last) last = d; 
    } 
  });
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
function scrollToLastWork() {
  const idx = getFinalWorkZoneIndex();
  if(idx!==-1) document.getElementById(`zone-card-${idx}`)?.scrollIntoView({behavior:'smooth'});
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
  document.getElementById('loading').style.display = 'flex';
  const res = await callGAS("addNewRecord", { date: document.getElementById('work-date').value, type: activeType, ids: Array.from(selectedUnits), editRow: editingLogRow });
  selectedUnits.clear(); editingLogRow = null; await silentLogin(); switchView('log');
}

function renderLogs() {
  const filtered = DATA.logs.filter(l => l.type === activeType);
  document.getElementById('log-list').innerHTML = filtered.map(l => `
    <div style="background:var(--card); padding:15px; margin-bottom:10px; border-radius:10px; border-left:5px solid var(--accent);">
      <div style="font-size:11px; color:var(--text-dim);">${l.date} (${l.day}) - ${l.user}</div>
      <div style="display:flex; justify-content:space-between; margin-top:5px;">
        <div style="font-weight:900;">${l.zone} (No.${l.s}-${l.e})</div>
        <div style="color:var(--accent); font-weight:900;">${l.count} units</div>
      </div>
      <div style="text-align:right; margin-top:10px; font-size:12px;">
        <span onclick="startEdit(${l.row},'${l.ids}','${l.date}')" style="color:var(--accent); margin-right:15px;">編集</span>
        <span onclick="handleDelete(${l.row})" style="color:var(--danger);">削除</span>
      </div>
    </div>`).join('');
}
function startEdit(row, ids, date) { editingLogRow=row; selectedUnits=new Set(ids.split(',').map(Number)); document.getElementById('work-date').value=date.replace(/\//g,'-'); switchView('work'); }
function cancelEdit() { editingLogRow=null; selectedUnits.clear(); renderAll(); }
async function handleDelete(row) { if(confirm("削除しますか？")) { document.getElementById('loading').style.display='flex'; await callGAS("deleteLog",{row}); await silentLogin(); } }
// QRを表示する関数
function showQR() {
  const target = document.getElementById("qr-target");
  if (!target) return;

  target.innerHTML = ""; // 前回のQRを消去（重要！）
  
  // QRCodeライブラリを使用して生成
  new QRCode(target, {
    text: window.location.href, // 現在のサイトURL
    width: 180,
    height: 180,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });

  document.getElementById("qr-overlay").style.display = "flex";
}

// QRを閉じる関数（ここが反応していない可能性があります）
function hideQR() {
  const overlay = document.getElementById("qr-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}
