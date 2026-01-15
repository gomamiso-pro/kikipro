/**
 * app.js - KIKI PRO V17 Refined
 */

let authID = localStorage.getItem('kiki_authID') || "";
let authPass = localStorage.getItem('kiki_authPass') || "";
let DATA = {};
let activeType = "通常";
let displayMode = "tile"; 
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;

const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

window.onload = () => {
  if (authID && authPass) {
    silentLogin(); 
  } else {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('loading').style.display = 'none';
  }
  
  // 日付初期化
  const d = new Date();
  document.getElementById('work-date').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  updateDateDisplay();
};

// ログイン・データ取得
async function silentLogin() {
  try {
    DATA = await callGAS("getInitialData", { authID, authPass }); 
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    document.body.classList.add('ready');
  } catch (e) {
    localStorage.clear();
    location.reload();
  }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  if (!nick || !pass) return alert("入力してください");

  // 即座にグルグルを表示
  document.getElementById('loading').style.display = 'flex';

  try {
    DATA = await callGAS("getInitialData", { authID: nick, authPass: pass });
    authID = nick; authPass = pass;
    localStorage.setItem('kiki_authID', authID);
    localStorage.setItem('kiki_authPass', authPass);
    
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    document.body.classList.add('ready');
  } catch (e) {
    // api.js側でloaderは消える
  }
}

// 描画コア
function renderAll() {
  if (!DATA.cols) return;

  // タイプタブ描画
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

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  
  container.innerHTML = DATA.cols.map((z, idx) => {
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    if (zoneUnits.length === 0) return '';
    
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    
    return `
      <div id="zone-card-${idx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === idx ? 'expanded' : ''}" style="background-color:${z.color || '#fff'}" onclick="handleZoneAction(event, ${idx})">
        <div class="f-oswald">${formatLastDate(z)}</div>
        <div class="tile-name">${z.name}</div>
        <div class="f-oswald">No.${z.s}-${z.e}</div>
        <div class="tile-count">${selCount}<small style="font-size:10px; opacity:0.6;">/${zoneUnits.length}</small></div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        
        <div class="expand-box" style="display:${expandedZoneId === idx ? 'block' : 'none'}">
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; padding:10px;">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-exec" onclick="closeExpand(event)" style="margin-top:20px;">閉じる</button>
        </div>
      </div>`;
  }).join('');
}

function renderList() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType];

  container.innerHTML = DATA.cols.map((z, idx) => {
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    if (zoneUnits.length === 0) return '';
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;

    return `
      <div id="zone-card-${idx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === idx ? 'expanded' : ''}" onclick="handleZoneAction(event, ${idx})">
        <div style="padding:15px; background:${z.color || '#fff'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="font-size:16px;">${z.name}</b>
            <span class="f-oswald">${formatLastDate(z)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:8px;">
            <span class="f-oswald" style="font-size:24px; font-weight:900;">No.${z.s}-${z.e}</span>
            <div class="f-oswald" style="font-size:24px;">${selCount}<small style="font-size:14px;">/${zoneUnits.length}台</small></div>
          </div>
          <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
        </div>
        <div class="expand-box" style="display:${expandedZoneId === idx ? 'block' : 'none'}">
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; padding:20px;">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-exec" onclick="closeExpand(event)" style="margin:20px; width:calc(100% - 40px);">閉じる</button>
        </div>
      </div>`;
  }).join('');
}

// 🚩ジャンプ機能
function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return;
  const target = document.getElementById(`zone-card-${finalIdx}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('jump-highlight');
    setTimeout(() => target.classList.remove('jump-highlight'), 3000);
  }
}

// 通信処理
async function upload() {
  if (selectedUnits.size === 0) return;
  document.getElementById('loading').style.display = 'flex';
  try {
    DATA = await callGAS("addNewRecord", { 
      authID, authPass, date: document.getElementById('work-date').value, 
      type: activeType, ids: Array.from(selectedUnits) 
    });
    selectedUnits.clear(); renderAll(); switchView('log'); 
  } catch (e) {}
}

// 補助関数
function toggleUnit(id) { selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id); updateCount(); renderAll(); }
function updateCount() { document.getElementById('u-total').innerText = selectedUnits.size; document.getElementById('send-btn').disabled = (selectedUnits.size === 0); }
function changeType(t) { activeType = t; selectedUnits.clear(); expandedZoneId = null; renderAll(); }
function handleZoneAction(e, i) { if(e.target.closest('.expand-box')) return; expandedZoneId = (expandedZoneId === i) ? null : i; renderAll(); }
function closeExpand(e) { e.stopPropagation(); expandedZoneId = null; renderAll(); }
function setMode(m) { displayMode = m; renderAll(); }
function updateDateDisplay() { 
  const d = new Date(document.getElementById('work-date').value);
  document.getElementById('date-label').innerText = `${d.getMonth()+1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
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
function getFinalWorkZoneIndex() {
  const col = DATE_COL_MAP[activeType];
  let maxD = null, lastId = -1;
  DATA.master?.forEach(m => { if(m[col]){ const d=new Date(m[col]); if(!maxD||d>maxD){ maxD=d; lastId=m[0]; } } });
  return DATA.cols?.findIndex(z => lastId >= Math.min(z.s,z.e) && lastId <= Math.max(z.s,z.e));
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
function showManual() { document.getElementById('manual-overlay').style.display = 'flex'; }
function hideManual() { document.getElementById('manual-overlay').style.display = 'none'; }
function showQR() { document.getElementById('qr-overlay').style.display = 'flex'; new QRCode(document.getElementById('qr-target'), {text: window.location.href, width:200, height:200}); }
function hideQR() { document.getElementById('qr-overlay').style.display = 'none'; }
