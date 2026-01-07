const GAS_API_URL = "https://script.google.com/macros/s/AKfycbz35ARxxw6AmCo4ZJ_EQA0NVRmSqxMp-1fCC7GtUU-MY8zjCIJ1_RkonxxspQ-uoLCpow/exec";


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

window.onload = async () => {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');
  if (savedID && savedPass) {
    authID = savedID; authPass = savedPass;
    const success = await silentLogin();
    if (!success) showLoginUI();
  } else { showLoginUI(); }
  const d = new Date();
  document.getElementById('work-date').value = d.toISOString().split('T')[0];
  updateDateDisplay();
};

function showLoginUI() { document.getElementById('login-overlay').style.display = 'flex'; }

async function handleAuth() {
  if (isRegisterMode) {
    const d = { newNick: document.getElementById('reg-nick').value, newID: document.getElementById('reg-id').value, newPass: document.getElementById('reg-pass').value };
    if (!d.newNick || !d.newID || !d.newPass) return alert("全項目入力");
    document.getElementById('loading').style.display = 'flex';
    const res = await callGAS("registerUser", d);
    document.getElementById('loading').style.display = 'none';
    if (res.status === "success") { alert(res.message); toggleAuthMode(); } else alert(res.message);
  } else {
    authID = document.getElementById('login-id').value;
    authPass = document.getElementById('login-pass').value;
    const success = await silentLogin();
    if (success && document.getElementById('auto-login').checked) {
      localStorage.setItem('kiki_authID', authID); localStorage.setItem('kiki_authPass', authPass);
    }
  }
}

async function silentLogin() {
  document.getElementById('loading').style.display = 'flex';
  try {
    const res = await callGAS("getInitialData");
    if (res.status === "error") { localStorage.clear(); return false; }
    document.getElementById('login-overlay').style.display = 'none';
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    document.getElementById('user-logo').innerText = DATA.user.charAt(0).toUpperCase();
    renderAll();
    return true;
  } catch (e) { return false; } finally { document.getElementById('loading').style.display = 'none'; }
}

async function callGAS(method, data = {}) {
  data.authID = authID; data.authPass = authPass;
  const res = await fetch(GAS_API_URL, { method: "POST", body: JSON.stringify({ method, data }) });
  return await res.json();
}

function renderAll() {
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => `<button class="type-btn ${t===activeType?'active':''}" onclick="changeType('${t}')">${t}</button>`).join('');
  displayMode === 'list' ? renderList() : renderTile();
  updateCount();
}

function renderList() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-list";
  container.innerHTML = generateCardsHTML(true);
}

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  container.innerHTML = generateCardsHTML(false);
}

function generateCardsHTML(isList) {
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  return DATA.cols.map((z, i) => {
    const units = DATA.master.filter(m => Number(m[0])>=Math.min(z.s,z.e) && Number(m[0])<=Math.max(z.s,z.e) && (Number(m[tIdx])===1 || selectedUnits.has(Number(m[0]))));
    if (!units.length) return "";
    const sel = units.filter(m => selectedUnits.has(Number(m[0]))).length;
    const lastDateStr = formatLastDate(z);

    if (isList) {
      return `
        <div id="zone-card-${i}" class="base-card ${sel>0?'has-selection':''} ${expandedZoneId===i?'expanded':''}" onclick="handleZoneAction(event, ${i})">
          <div class="card-top" style="background:${z.bg}; padding:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <div onclick="handleZoneCheck(event, ${z.s}, ${z.e})">
                <input type="checkbox" ${sel===units.length?'checked':''} style="width:24px; height:24px; pointer-events:none;">
              </div>
              <span style="font-weight:900; font-size:22px;">${i===finalIdx?'🚩':''}${z.name}</span>
            </div>
            <span style="font-size:22px; font-weight:900;">${lastDateStr}</span>
          </div>
          <div class="card-mid" style="background:${z.bg}; padding: 0 12px 12px 12px;">
            <span class="f-oswald" style="font-size:40px; font-weight:900;">No.${z.s}-${z.e}</span>
            <span class="f-oswald" style="font-size:26px; font-weight:900;">${sel} / ${units.length}</span>
          </div>
          <div class="progress-container">${units.map(m=>`<div class="p-seg ${selectedUnits.has(Number(m[0]))?'active':''}"></div>`).join('')}</div>
          <div class="expand-box" onclick="event.stopPropagation()">
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(70px, 1fr)); gap:10px;">
              ${units.map(m=>`<div class="unit-chip ${selectedUnits.has(Number(m[0]))?'active':''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
            </div>
          </div>
        </div>`;
    } else {
      // 全体表示（5段構成）
      return `
        <div id="zone-card-${i}" class="base-card ${sel>0?'has-selection':''} ${expandedZoneId===i?'expanded':''}" style="background:${z.bg};" onclick="handleZoneAction(event, ${i})">
          <div class="tile-row" style="padding:4px 5px; justify-content:space-between; border-bottom:1px solid rgba(0,0,0,0.1);">
            <div onclick="handleZoneCheck(event, ${z.s}, ${z.e})"><input type="checkbox" ${sel===units.length?'checked':''} style="width:14px; height:14px; pointer-events:none;"></div>
            <span style="font-size:10px; font-weight:900;">${lastDateStr}</span>
          </div>
          <div class="tile-row-center" style="font-size:11px; font-weight:900;">${i===finalIdx?'🚩':''}${z.name.replace('ゾーン','')}</div>
          <div class="tile-row-center f-oswald" style="font-size:12px; font-weight:900;">No.${z.s}-${z.e}</div>
          <div class="tile-row-center f-oswald" style="font-size:11px; font-weight:900;">${sel}/${units.length}</div>
          <div class="progress-container" style="height:7px;">${units.map(m=>`<div class="p-seg ${selectedUnits.has(Number(m[0]))?'active':''}"></div>`).join('')}</div>
          <div class="expand-box" onclick="event.stopPropagation()">
            ${units.map(m=>`<div class="unit-chip ${selectedUnits.has(Number(m[0]))?'active':''}" onclick="toggleUnit(${m[0]})" style="padding:5px 0; font-size:10px;">${m[0]}</div>`).join('')}
          </div>
        </div>`;
    }
  }).join('');
}

function formatLastDate(z) {
  const col = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0])>=Math.min(z.s,z.e) && Number(m[0])<=Math.max(z.s,z.e));
  let last = null;
  units.forEach(m => { if(m[col]) { const d=new Date(m[col]); if(!last || d>last) last=d; } });
  if(!last) return "未";
  const day = ["日","月","火","水","木","金","土"][last.getDay()];
  return `${last.getMonth()+1}/${last.getDate()}(${day})`;
}

function getFinalWorkZoneIndex() {
  const col = DATE_COL_MAP[activeType];
  let last=null, maxId=-1;
  DATA.master.forEach(m => { if(m[col]) { const d=new Date(m[col]); if(!last || d>last || (d.getTime()===last.getTime() && Number(m[0])>maxId)) { last=d; maxId=Number(m[0]); } } });
  return DATA.cols.findIndex(z => maxId>=Math.min(z.s,z.e) && maxId<=Math.max(z.s,z.e));
}

function logout() { if(confirm("ログアウト？")) { localStorage.clear(); location.reload(); } }
function showQR() {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.href)}`;
  document.getElementById('qr-target').innerHTML = `<img src="${url}" style="width:200px; border:10px solid #fff;">`;
  document.getElementById('qr-overlay').style.display = 'flex';
}
function hideQR() { document.getElementById('qr-overlay').style.display = 'none'; }
function changeType(t) { activeType = t; expandedZoneId = null; if(!editingLogRow) selectedUnits.clear(); renderAll(); }
function handleZoneAction(e, idx) { e.stopPropagation(); expandedZoneId = (expandedZoneId === idx) ? null : idx; renderAll(); }
function handleZoneCheck(e, s, eNum) {
  e.stopPropagation();
  const tIdx = TYPE_MAP[activeType];
  const ids = DATA.master.filter(m => Number(m[0])>=Math.min(s,eNum) && Number(m[0])<=Math.max(s,eNum) && Number(m[tIdx])===1).map(m=>Number(m[0]));
  ids.every(id=>selectedUnits.has(id)) ? ids.forEach(id=>selectedUnits.delete(id)) : ids.forEach(id=>selectedUnits.add(id));
  renderAll();
}
function toggleUnit(id) { selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id); renderAll(); }
function updateCount() { document.getElementById('u-total').innerText = selectedUnits.size; document.getElementById('send-btn').disabled = !selectedUnits.size; }
function updateDateDisplay() {
  const d = new Date(document.getElementById('work-date').value);
  document.getElementById('date-label').innerText = `${d.getMonth()+1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
}
function switchView(v) {
  const isWork = (v==='work');
  document.getElementById('view-work').style.display = isWork?'block':'none';
  document.getElementById('view-log').style.display = isWork?'none':'block';
  document.getElementById('view-mode-controls').style.display = isWork?'block':'none';
  document.getElementById('tab-work').className = 'top-tab '+(isWork?'active-work':'');
  document.getElementById('tab-log').className = 'top-tab '+(!isWork?'active-log':'');
  if(!isWork) renderLogs();
}
function setMode(m) { displayMode = m; renderAll(); }
function scrollToLastWork() {
  const idx = getFinalWorkZoneIndex();
  if(idx!==-1) document.getElementById(`zone-card-${idx}`)?.scrollIntoView({behavior:'smooth'});
}
function toggleAllSelection() {
  const tIdx = TYPE_MAP[activeType];
  const ids = DATA.master.filter(m => Number(m[tIdx])===1).map(m=>Number(m[0]));
  ids.every(id=>selectedUnits.has(id)) ? selectedUnits.clear() : ids.forEach(id=>selectedUnits.add(id));
  renderAll();
}
async function upload() {
  document.getElementById('loading').style.display = 'flex';
  await callGAS("addNewRecord", { date: document.getElementById('work-date').value, type: activeType, ids: Array.from(selectedUnits), editRow: editingLogRow });
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
async function handleDelete(row) { if(confirm("削除？")) { document.getElementById('loading').style.display='flex'; await callGAS("deleteLog",{row}); await silentLogin(); renderLogs(); } }
function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('auth-title').innerText = isRegisterMode ? "NEW REGISTER" : "KIKI LOGIN";
  document.getElementById('login-fields').style.display = isRegisterMode ? "none" : "block";
  document.getElementById('register-fields').style.display = isRegisterMode ? "block" : "none";
  document.getElementById('auth-submit').innerText = isRegisterMode ? "新規登録" : "ログイン";
  document.getElementById('auth-toggle').innerText = isRegisterMode ? "戻る" : "こちら";
}
function closeAllDetails() { if(expandedZoneId!==null){expandedZoneId=null; renderAll();} }
