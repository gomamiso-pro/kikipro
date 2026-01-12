/**
 * KIKI PRO V15 - Complete Stable App Logic
 */

// --- 1. グローバル変数の宣言 ---
authID = localStorage.getItem('kiki_authID') || "";
authPass = localStorage.getItem('kiki_authPass') || "";
let DATA = {};
let activeType = "通常";
let displayMode = "list";
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;
let isSignUpMode = false;

// 共通設定
const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

// --- 2. 初期起動処理 ---
window.onload = () => {
  silentLogin();
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    dateInput.value = `${y}-${m}-${day}`;
    updateDateDisplay();
  }
};

// --- 3. 認証・データ取得コア ---
// ※ callGAS 本体は api.js で定義されているため、ここでは再定義しません。

async function silentLogin() {
  if (!authID || !authPass) {
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }
  try {
    const res = await callGAS("getInitialData");
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    document.body.classList.add('ready');
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) {
    console.error("Silent Login Failed:", e);
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
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
    // api.js 内の alert でエラー表示済み
  }
}

// --- 4. 描画ロジック ---
function renderAll() {
  if (!DATA || !DATA.cols) return;

  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  const tabContainer = document.getElementById('type-tabs');
  if (tabContainer) {
    tabContainer.innerHTML = types.map(t => {
      const lastDate = getFinalDateByType(t);
      return `
        <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
          ${t}<span class="type-last-badge">${lastDate}</span>
        </button>`;
    }).join('');
  }
  
  updateToggleAllBtnState();
  const viewWork = document.getElementById('view-work');
  if (viewWork && viewWork.style.display !== 'none') {
    displayMode === 'list' ? renderList() : renderTile();
  } else {
    renderLogs();
  }
  updateCount();
}

function renderList() {
  const container = document.getElementById('zone-display');
  if (!container) return;
  container.className = "zone-container-list";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  container.innerHTML = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  ).map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const bgColor = z.color || "#ffffff";
    const isFinal = (originalIdx === finalIdx);

    // 修正ポイント: onclick="handleZoneAction(event, ${originalIdx})" 
    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="padding:15px; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:15px;">
            <div onclick="handleZoneCheck(event, ${originalIdx})">
              <input type="checkbox" ${isAll ? 'checked' : ''} style="transform:scale(1.5); pointer-events:none;">
            </div>
            <div>
              <div style="font-size:20px; font-weight:900;">${z.name}</div>
              <div class="f-oswald" style="font-size:18px; font-weight:700; opacity:0.8;">No.${z.s} - ${z.e}</div>
            </div>
          </div>
          <div style="text-align:right; display:flex; flex-direction:column; justify-content:center;">
            <div class="f-oswald" style="font-size:16px; font-weight:700; color:var(--text);">
              ${isFinal ? '<span style="color:#ff3b3b; margin-right:2px;">🚩</span>' : ''}${formatLastDate(z)}
            </div>
            <div class="f-oswald" style="font-size:32px; font-weight:900; line-height:1.1; color:var(--accent);">
              ${selCount}<span style="font-size:16px; opacity:0.6; color:var(--text);">/${zoneUnits.length}</span>
            </div>
          </div>
        </div>
        <div class="status-bar-bg" style="height:8px;">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">完了</button>
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
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const bgColor = z.color || "#ffffff";
    const rawName = z.name.replace('ゾーン', '');

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row-1">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none;">
          </div>
          <div class="f-oswald">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z, true)}</div>
        </div>
        
        <div class="tile-row-2 tile-fit-text">
          <b>${getFitSpan(rawName, 20)}</b>
        </div>
        
        <div class="tile-row-3 f-oswald tile-fit-text" style="color: #000 !important; font-weight: 700;">
          ${getFitSpan(`No.${z.s}-${z.e}`, 16)}
        </div>
        
        <div class="tile-row-4 f-oswald">${selCount}<small style="font-size:9px; opacity:0.7;">/${zoneUnits.length}</small></div>
        <div class="tile-row-5 status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="expand-box" onclick="event.stopPropagation()">
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">完了</button>
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
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const bgColor = z.color || "#ffffff";
    const rawName = z.name.replace('ゾーン', '');

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${bgColor} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        
        <div class="tile-row-1" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2px;">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none; transform: scale(0.8);">
          </div>
          <div class="f-oswald" style="font-size:10px; opacity: 0.8;">${originalIdx === finalIdx ? '🚩' : ''}${formatLastDate(z, true)}</div>
        </div>
        
        <div class="tile-row-2" style="text-align: left; padding-left: 5px; height: 24px; overflow: hidden;">
          <b>${getFitSpan(rawName, 19, 60)}</b>
        </div>
        
        <div class="tile-row-3 f-oswald" style="text-align: left; padding-left: 5px; color: #000 !important; font-weight: 700; height: 18px; overflow: hidden;">
          ${getFitSpan(`No.${z.s}-${z.e}`, 15, 60)}
        </div>
        
        <div class="tile-row-4 f-oswald" style="text-align: right; padding-right: 2px; margin-top: 2px;">
          <span style="font-size: 18px; font-weight: 900;">${selCount}</span><small style="font-size:9px; opacity:0.7;">/${zoneUnits.length}</small>
        </div>

        <div class="tile-row-5 status-bar-bg" style="margin-top: 4px;">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>

        <div class="expand-box" onclick="event.stopPropagation()">
          <div class="unit-grid">
            ${zoneUnits.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${Number(m[0])})">${m[0]}</div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)">完了</button>
        </div>
      </div>`;
  }).join('');
}

function getFitSpan(text, baseSize, limitWidth = 60) {
  let estimatedWidth = 0;
  for (let char of String(text)) {
    // 半角は0.6倍、全角は1倍で幅を概算
    estimatedWidth += char.match(/[ -~]/) ? baseSize * 0.7 : baseSize;
  }
  
  // 収まる場合はスケール1、超える場合のみ圧縮率を計算
  const scale = estimatedWidth > limitWidth ? limitWidth / estimatedWidth : 1;
  
  // transform-origin: left で左端を固定して縮小
  return `<span class="tile-fit-inner" style="
      font-size:${baseSize}px; 
      transform:scaleX(${scale}); 
      transform-origin: left; 
      display: inline-block; 
      white-space: nowrap;
      letter-spacing: -0.5px; 
    ">${text}</span>`;
}
function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  document.getElementById('log-list').innerHTML = filtered.map(l => {
    const ids = l.ids ? String(l.ids).split(',').map(Number).sort((a,b)=>a-b) : [];
    const rangeStr = ids.length > 0 ? `${ids[0]}～${ids[ids.length-1]}` : '---';
    return `
    <div class="log-card">
      <div class="log-date-badge">${l.type} - ${l.date}</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-end;">
        <div>
          <div class="log-main-info" style="font-size:18px; font-weight:900; color:var(--accent);">${l.zone}</div>
          <div class="f-oswald log-range">No.${rangeStr}</div>
          <div style="font-size:11px; opacity:0.6;">登録者: ${l.user}</div>
        </div>
        <div class="log-unit-large">${l.count}<small style="font-size:12px;">台</small></div>
      </div>
      <div class="log-action-row" style="display:flex; gap:12px; margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;">
        <button class="btn-log-edit shadow-blue" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')" style="flex:1;">編集</button>
        <button class="btn-log-del shadow-red" onclick="handleDelete(${l.row})" style="flex:1;">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:120px;"></div>`;
}

// --- 5. ユーティリティ & アクション ---
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

function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let maxDate = null;
  if (!DATA.master || !DATA.cols) return -1;
  DATA.master.forEach(m => {
    if (m[tCol]) {
      const d = new Date(m[tCol]);
      if (!maxDate || d > maxDate) maxDate = d;
    }
  });
  if (!maxDate) return -1;
  let lastId = -1;
  DATA.master.forEach(m => {
    if (m[tCol] && new Date(m[tCol]).getTime() === maxDate.getTime()) lastId = Number(m[0]);
  });
  return DATA.cols.findIndex(z => lastId >= Math.min(z.s, z.e) && lastId <= Math.max(z.s, z.e));
}

function handleZoneAction(event, index) {
  if (event.target.type === 'checkbox' || event.target.closest('.check-wrapper') || event.target.closest('.expand-box')) return;
  event.stopPropagation();
  expandedZoneId = (expandedZoneId === index) ? null : index;
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
  updateCount();
  displayMode === 'list' ? renderList() : renderTile();
}

function updateCount() {
  const count = selectedUnits.size;
  const countEl = document.getElementById('u-total');
  if (countEl) countEl.innerText = count;
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = (count === 0);
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) cancelBtn.style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function changeType(t) { 
  activeType = t; 
  expandedZoneId = null; 
  if (!editingLogRow) selectedUnits.clear(); 
  renderAll(); 
}

function closeExpand(e) { e.stopPropagation(); expandedZoneId = null; renderAll(); }

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val);
  const days = ["日","月","火","水","木","金","土"];
  document.getElementById('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function switchView(v) {
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('view-mode-controls').style.display = isWork ? 'flex' : 'none';
  document.getElementById('footer-content-wrap').style.display = isWork ? 'block' : 'none';
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function formatLastDate(z, isShort = false) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
  let last = null;
  units.forEach(m => { if (m[tCol]) { const d = new Date(m[tCol]); if (!last || d > last) last = d; } });
  if (!last) return "未";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${last.getMonth() + 1}/${last.getDate()}(${days[last.getDay()]})`;
}

function setMode(m) { 
  displayMode = m; 
  document.getElementById('mode-list-btn').classList.toggle('active', m === 'list'); 
  document.getElementById('mode-tile-btn').classList.toggle('active', m === 'tile'); 
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

async function upload() {
  if (selectedUnits.size === 0) return;
  try {
    await callGAS("addNewRecord", { 
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    await silentLogin();
    cancelEdit(); 
    switchView('log');
  } catch (e) { }
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); expandedZoneId = null; renderAll(); }

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
    } catch (e) {}
  } 
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN";
  document.getElementById('auth-submit').innerText = isSignUpMode ? "REGISTER & LOGIN" : "LOGIN";
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
/**
 * HTMLのボタン「GO TO 最終🚩」から呼び出される関数
 */
/**
 * 最終作業日（🚩マーク）のゾーンまでスクロールし、点滅させる
 */
function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  
  if (finalIdx === -1) {
    alert("最新の作業データが見つかりませんでした。");
    return;
  }

  const targetId = `zone-card-${finalIdx}`;
  const targetEl = document.getElementById(targetId);

  if (targetEl) {
    // スムーズにスクロール
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 一旦クラスを消してから再度付与（連続押しに対応）
    targetEl.classList.remove('jump-highlight');
    
    // わずかな遅延のあとクラスを付与してアニメーション開始
    setTimeout(() => {
      targetEl.classList.add('jump-highlight');
    }, 100);

    // アニメーション終了時間（1.5秒後）にクラスを除去
    setTimeout(() => {
      targetEl.classList.remove('jump-highlight');
    }, 1600);
    
  } else {
    alert("現在のタブ（" + activeType + "）には最終作業ゾーンが表示されていません。");
  }
}

// ※ logout() は api.js に記述済みなので app.js には不要です（重複防止）
