/**
 * KIKI PRO V13 - Main Application Logic
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  document.getElementById('work-date').value = `${y}-${m}-${day}`;
  updateDateDisplay();
};

async function silentLogin() {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');
  
  if (!savedID || !savedPass) {
    const loader = document.getElementById('loading');
    if(loader) loader.style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }

  try {
    authID = savedID;
    authPass = savedPass;
    const res = await callGAS("getInitialData");
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.body.classList.add('ready');
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) {
    console.error(e);
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
  } catch (e) { 
    alert(e.message); 
  }
}

function renderAll() {
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => {
    const lastDate = getFinalDateByType(t);
    return `
      <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
        ${t}
        <span class="type-last-badge">${lastDate}</span>
      </button>`;
  }).join('');
  
  updateToggleAllBtnState();
  const viewWork = document.getElementById('view-work');
  if (viewWork.style.display !== 'none') {
    displayMode === 'list' ? renderList() : renderTile();
  } else { 
    renderLogs(); 
  }
  updateCount();
}

function getFinalDateByType(type) {
  const tCol = DATE_COL_MAP[type];
  let last = null;
  if (!DATA.master) return "未";
  DATA.master.forEach(m => {
    if (m[tCol]) {
      const d = new Date(m[tCol]);
      if (!last || d > last) last = d;
    }
  });
  if (!last) return "未";
  const days = ["日","月","火","水","木","金","土"];
  return `${last.getMonth() + 1}/${last.getDate()}(${days[last.getDay()]})`;
}

function changeType(t) { 
  activeType = t; 
  expandedZoneId = null; 
  if (!editingLogRow) selectedUnits.clear(); 
  renderAll(); 
}

function updateToggleAllBtnState() {
  const btn = document.getElementById('toggle-all-btn');
  if (!btn) return;
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

/**
 * 文字幅調整用ユーティリティ
 */
function fitText(text, limit) {
  if (text.length > limit) {
    const scale = limit / text.length;
    return `<span style="display:inline-block; transform:scaleX(${scale}); transform-origin:left; white-space:nowrap;">${text}</span>`;
  }
  return `<span>${text}</span>`;
}

/**
 * リスト表示の描画
 */
function renderList() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  const activeZones = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  );

  container.innerHTML = activeZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    
    // 背景色設定（z.color または z.bg のどちらでも動作するように担保）
    const bgColor = (z.color || z.bg) && (z.color || z.bg) !== "" ? (z.color || z.bg) : "#ffffff";

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important; color: #000 !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="display:flex; width:100%; align-items:center; padding:12px;">
          <div class="zone-check-area" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="transform:scale(1.5); pointer-events:none; margin-right:15px;">
          </div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b style="font-size:18px; color:#000;">${z.name}</b>
              <span class="f-oswald" style="font-size:18px; color:#000;">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:5px;">
              <span class="f-oswald" style="font-size:24px; color:#000;">No.${z.s}-${z.e}</span>
              <span class="f-oswald" style="font-size:24px; color:#000;">${selCount}/${zoneUnits.length}台</span>
            </div>
          </div>
        </div>
        <div class="status-bar-bg" style="background: rgba(0,0,0,0.15);">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" style="${selectedUnits.has(Number(m[0])) ? 'background:#000;' : ''}"></div>`).join('')}</div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">閉じる</button>
        </div>
      </div>`;
  }).join('');
}

/**
 * 全体（タイル）表示の描画
 */
function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  container.innerHTML = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  ).map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    
    // 背景色設定
    const bgColor = (z.color || z.bg) && (z.color || z.bg) !== "" ? (z.color || z.bg) : "#ffffff";
    const rawName = z.name.replace('ゾーン', '');
    const noStr = `No.${z.s}-${z.e}`;

    // 日付に曜日を付与する (formatLastDateが内部で曜日を返さない場合のバックアップ)
    let dateDisplay = formatLastDate(z, true);
    
    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        
        <div class="tile-row-1">
          <div onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="transform:scale(1.2); pointer-events:none;">
          </div>
          <div class="f-oswald">${originalIdx === finalIdx ? '🚩' : ''}${dateDisplay}</div>
        </div>

        <div class="tile-row-2"><b>${fitText(rawName, 5)}</b></div>
        
        <div class="tile-row-3 f-oswald">${fitText(noStr, 10)}</div>
        
        <div class="tile-row-4 f-oswald">
          ${selCount}<small>/${zoneUnits.length}</small>
        </div>

        <div class="tile-row-5 status-bar-bg">
          ${zoneUnits.map(m => `
            <div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>
          `).join('')}
        </div>
        
        <div class="expand-box" onclick="event.stopPropagation()">
          <h3 style="margin:0 0 15px 0; font-size:18px;">${z.name} - ユニット選択</h3>
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">選択を完了する</button>
        </div>
      </div>`;
  }).join('');
}

function closeExpand(e) {
  e.stopPropagation();
  expandedZoneId = null;
  renderAll();
}

function handleZoneAction(e, idx) { 
  e.stopPropagation(); 
  expandedZoneId = (expandedZoneId === idx) ? null : idx; 
  renderAll(); 
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

function toggleUnit(id) {
  selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id);
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
  if (!val) return;
  const d = new Date(val);
  const days = ["日","月","火","水","木","金","土"];
  document.getElementById('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
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
  document.getElementById('view-mode-controls').style.display = isWork ? 'flex' : 'none';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function formatLastDate(z, isShort = false) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  
  let last = null;
  units.forEach(m => { 
    if (m[tCol]) { 
      const d = new Date(m[tCol]); 
      if (!last || d > last) last = d; 
    } 
  });

  if (!last) return "未";

  const m = last.getMonth() + 1;
  const d = last.getDate();
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const day = days[last.getDay()];

  // isShort (タイル表示) でも曜日を入れる。
  // 4列表示で収まりを良くするため、スペースを詰めた表記に。
  if (isShort) {
    return `${m}/${d}(${day})`; 
  }

  // リスト表示など（通常）
  return `${m}/${d}(${day})`;
}

function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let last = null, maxId = -1;
  if (!DATA.master) return -1;
  DATA.master.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) { last = d; maxId = Number(m[0]); } } });
  return DATA.cols.findIndex(z => maxId >= Math.min(z.s, z.e) && maxId <= Math.max(z.s, z.e));
}

function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return;
  const target = document.getElementById(`zone-card-${finalIdx}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // ボタンの押し感を出すための視覚的フィードバック
    target.style.transform = "scale(1.05)";
    setTimeout(() => target.style.transform = "", 300);
  }
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
    cancelEdit(); 
    await silentLogin(); 
    switchView('log');
  } catch (e) { 
    alert("通信エラーが発生しました"); 
  }
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
    const ids = l.ids ? String(l.ids).split(',').map(Number).sort((a,b)=>a-b) : [];
    const rangeStr = ids.length > 0 ? `${ids[0]}～${ids[ids.length-1]}` : '---';
    
    // 日付に曜日を追加
    let dateWithDay = l.date;
    try {
      const d = new Date(l.date.replace(/\//g, '-'));
      const days = ["日","月","火","水","木","金","土"];
      dateWithDay += `(${days[d.getDay()]})`;
    } catch(e) {}

    return `
    <div class="log-card">
      <div class="log-date-badge">${l.type} - ${dateWithDay}</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-end; color:#fff;">
        <div>
          <div class="log-main-info" style="font-size:18px; font-weight:900;">${l.zone}</div>
          <div class="f-oswald log-range">No.${rangeStr}</div>
          <div style="font-size:11px; opacity:0.6;">担当: ${l.user}</div>
        </div>
        <div class="log-unit-large">${l.count}<small style="font-size:12px;">台</small></div>
      </div>
      <div class="log-action-row">
        <button class="btn-log-edit shadow-blue" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')">編集</button>
        <button class="btn-log-del shadow-red" onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:120px;"></div>`;
}

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  const idStr = ids ? String(ids) : "";
  selectedUnits = new Set(idStr.split(',').filter(x => x.trim() !== "").map(Number));
  activeType = type;
  if (date) document.getElementById('work-date').value = date.replace(/\//g, '-');
  updateDateDisplay(); 
  displayMode = 'tile';
  switchView('work');
  renderAll();
}

async function handleDelete(row) { 
  if (confirm("この履歴を削除しますか？")) { 
    try { 
      await callGAS("deleteLog", { row }); 
      await silentLogin(); 
    } catch (e) { 
      alert("エラーが発生しました"); 
    }
  } 
}

function showQR() { 
  const target = document.getElementById("qr-target"); 
  if (!target) return;
  target.innerHTML = ""; 
  new QRCode(target, { text: window.location.href, width: 200, height: 200 }); 
  document.getElementById("qr-overlay").style.display = "flex"; 
}

function hideQR() { document.getElementById("qr-overlay").style.display = "none"; }
function showManual() { document.getElementById('manual-overlay').style.display = 'flex'; }
function hideManual() { document.getElementById('manual-overlay').style.display = 'none'; }

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN";
  document.getElementById('auth-submit').innerText = isSignUpMode ? "REGISTER & LOGIN" : "LOGIN";
}
