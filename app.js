/**
 * KIKI PRO V17 - Complete Logic
 * 全機能を維持し、通信安定性と描画パフォーマンスを最適化
 */

// --- 1. グローバル変数の宣言 ---
let DATA = {};
let activeType = "通常";
let displayMode = "tile"; 
let selectedUnits = new Set();
let editingLogRow = null;
let isSignUpMode = false;

// 定数 (Spreadsheetの列番号と連動)
const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

// --- 2. 初期起動処理 ---
window.onload = () => {
  // 保存された認証情報があれば自動ログイン
  silentLogin(); 
  
  // 日付の初期値を今日に設定
  const d = new Date();
  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    dateInput.value = d.toISOString().split('T')[0];
    updateDateDisplay();
  }
};

// --- 3. 認証・データ取得コア ---
async function silentLogin() {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');

  if (!savedID || !savedPass) {
    showLogin();
    return;
  }

  try {
    // 既存の api("getInitialData") を使用
    const res = await api('getInitialData', { authID: savedID, authPass: savedPass });
    setupAppData(res, savedID, savedPass);
  } catch (e) {
    console.error("Silent Login Failed:", e);
    showLogin();
  }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  if (!nick || !pass) return alert("ニックネームとパスワードを入力してください");

  try {
    const method = isSignUpMode ? "signUp" : "getInitialData";
    const res = await api(method, { authID: nick, authPass: pass, nickname: nick });
    
    // 自動ログインにチェックがあれば保存
    if (document.getElementById('auto-login').checked) {
      localStorage.setItem('kiki_authID', nick);
      localStorage.setItem('kiki_authPass', pass);
    }
    setupAppData(res, nick, pass);
  } catch (e) {
    // エラーメッセージは api.js の alert で表示されるためここではログのみ
    console.error("Auth Error:", e);
  }
}

function setupAppData(res, id, pass) {
  DATA = res;
  const userDisp = document.getElementById('user-display');
  if (userDisp) userDisp.innerText = DATA.user.toUpperCase();
  
  document.body.classList.remove('loading-state');
  document.body.classList.add('ready');
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-content').style.display = 'flex';
  
  renderAll();
}

function showLogin() {
  document.body.classList.remove('loading-state');
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
}

// --- 4. 通信アクション ---
async function upload() {
  if (selectedUnits.size === 0 && !editingLogRow) return;
  if (!confirm(editingLogRow ? "修正を保存しますか？" : "この内容で送信しますか？")) return;

  try {
    // 1. 送信実行
    const res = await api("addNewRecord", { 
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: Array.from(selectedUnits), 
      editRow: editingLogRow 
    });
    
    // 2. 成功したら戻り値の最新データを反映
    DATA = res;
    cancelEdit(); 
    switchView('log'); // 履歴画面へ
    alert("保存完了しました");
  } catch (e) { 
    console.error("Upload Failed:", e);
  }
}

async function handleDelete(row) { 
  if (!confirm("この履歴を完全に削除しますか？")) return;

  try { 
    const res = await api("deleteLog", { row }); 
    DATA = res; // 削除後の最新データを反映
    renderAll();
  } catch (e) {
    console.error("Delete Failed:", e);
  }
}

// --- 5. 描画ロジック ---
function renderAll() {
  if (!DATA || !DATA.cols) return;

  // 種別タブの更新
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  const tabContainer = document.getElementById('type-tabs');
  if (tabContainer) {
    tabContainer.innerHTML = types.map(t => {
      const lastDate = getFinalDateByType(t);
      return `
        <button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
          <div class="type-name-label">${t}</div>
          <div class="type-last-badge">${lastDate}</div>
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
  container.className = "zone-container-list"; 
  
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  const filteredZones = getFilteredZones(tIdx);

  container.innerHTML = filteredZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = getZoneUnits(z, tIdx);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="zone-row ${selCount > 0 ? 'has-selection' : ''}" onclick="handleZoneAction(event, ${originalIdx})">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:900; font-size:16px; color:#333;">${z.name}</div>
          <div class="f-oswald" style="font-size:13px; color:${isFinalZone ? '#d32f2f' : '#666'};">
            ${isFinalZone ? '🚩' : ''}${formatLastDate(z)}
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:4px;">
           <span class="f-oswald" style="font-size:20px; font-weight:900;">No.${z.s}-${z.e}</span>
           <div class="f-oswald" style="font-size:24px; font-weight:900;">${selCount}<small style="font-size:12px; opacity:0.6;">/${zoneUnits.length}</small></div>
        </div>
        <div class="status-bar-bg">${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  const filteredZones = getFilteredZones(tIdx);

  container.innerHTML = filteredZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = getZoneUnits(z, tIdx);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''}" 
           style="background-color: ${z.color || "#ffffff"} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-date-box">${isFinalZone ? '🚩' : ''}${formatLastDate(z)}</div>
        <div class="tile-row-2">${z.name.replace('ゾーン', '')}</div>
        <div class="tile-row-3 f-oswald">No.${z.s}</div>
        <div class="tile-row-4 f-oswald">${selCount}</div>
        <div class="tile-row-5 status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

// --- 6. ユーティリティ ---
function getFilteredZones(tIdx) {
  return DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  );
}

function getZoneUnits(z, tIdx) {
  return DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
}

function handleZoneAction(event, index) {
  const z = DATA.cols[index];
  const tIdx = TYPE_MAP[activeType];
  const zoneUnits = getZoneUnits(z, tIdx);
  
  const overlay = document.createElement('div');
  overlay.className = 'overlay expanded';
  overlay.id = 'expand-overlay';
  overlay.innerHTML = `
    <div style="font-weight:900; margin-bottom:15px; font-size:20px; color:#000; text-align:center;">${z.name}</div>
    <div class="unit-grid">
      ${zoneUnits.map(m => `
        <div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" 
             onclick="toggleUnit(${Number(m[0])}, this)">
          ${m[0]}
        </div>`).join('')}
    </div>
    <button class="btn-close-expand" onclick="document.getElementById('expand-overlay').remove()">完了</button>
  `;
  document.body.appendChild(overlay);
  overlay.style.display = 'flex';
}

function toggleUnit(id, el) {
  if (selectedUnits.has(id)) {
    selectedUnits.delete(id);
    if(el) el.classList.remove('active');
  } else {
    selectedUnits.add(id);
    if(el) el.classList.add('active');
  }
  updateCount();
  // 背後のタイル・リスト描画を遅延なしで更新
  displayMode === 'list' ? renderList() : renderTile();
}

function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  const logList = document.getElementById('log-list');
  if(!logList) return;

  logList.innerHTML = filtered.map(l => {
    const ids = l.ids ? String(l.ids).split(',').map(Number).sort((a,b)=>a-b) : [];
    const rangeStr = ids.length > 0 ? `${ids[0]}～${ids[ids.length-1]}` : '---';
    const d = new Date(l.date);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;

    return `
    <div class="log-card">
      <div class="log-content">
        <div>
          <div class="log-main-info">${l.zone}</div>
          <div class="log-range">${dateStr} | No.${rangeStr}</div>
          <div class="log-user-info">👤 ${l.user || '---'}</div>
        </div>
        <div class="log-unit-large">${l.count}</div>
      </div>
      <div class="log-action-row">
        <button class="btn-log-edit" onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')">編集</button>
        <button class="btn-log-del" onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:150px;"></div>`;
}

function getFinalDateByType(type) {
  const tCol = DATE_COL_MAP[type];
  let last = null;
  if (!DATA.master) return "未";
  DATA.master.forEach(m => { 
    if (m[tCol] && m[tCol] !== "未") { 
      const d = new Date(m[tCol]); 
      if (!isNaN(d) && (!last || d > last)) last = d; 
    } 
  });
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}(${["日","月","火","水","木","金","土"][last.getDay()]})`;
}

function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let maxDate = null;
  if (!DATA.master || !DATA.cols) return -1;
  DATA.master.forEach(m => { 
    if (m[tCol] && m[tCol] !== "未") { 
      const d = new Date(m[tCol]); 
      if (!isNaN(d) && (!maxDate || d > maxDate)) maxDate = d; 
    } 
  });
  if (!maxDate) return -1;
  let lastId = -1;
  DATA.master.forEach(m => { 
    if (m[tCol] && new Date(m[tCol]).getTime() === maxDate.getTime()) lastId = Number(m[0]); 
  });
  return DATA.cols.findIndex(z => lastId >= Math.min(z.s, z.e) && lastId <= Math.max(z.s, z.e));
}

function updateCount() {
  const count = selectedUnits.size;
  const totalEl = document.getElementById('u-total');
  if (totalEl) totalEl.innerText = count;
  
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.disabled = (count === 0 && !editingLogRow);
    sendBtn.innerText = editingLogRow ? "修正を保存" : "作業完了を送信";
  }
  
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) cancelBtn.style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function changeType(t) { 
  activeType = t; 
  selectedUnits.clear(); 
  editingLogRow = null;
  renderAll(); 
}

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
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
  renderAll();
}

function formatLastDate(z) {
  const tCol = DATE_COL_MAP[activeType];
  const units = getZoneUnits(z, TYPE_MAP[activeType]);
  let last = null;
  units.forEach(m => { 
    if (m[tCol] && m[tCol] !== "未") { 
      const d = new Date(m[tCol]); 
      if (!isNaN(d) && (!last || d > last)) last = d; 
    } 
  });
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}(${["日","月","火","水","木","金","土"][last.getDay()]})`;
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
  const isAll = allIds.length > 0 && allIds.every(id => selectedUnits.has(id));
  allIds.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function cancelEdit() { 
  editingLogRow = null; 
  selectedUnits.clear(); 
  renderAll(); 
}

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  const idStr = ids ? String(ids) : "";
  selectedUnits = new Set(idStr.split(',').filter(x => x.trim() !== "").map(Number));
  activeType = type;
  if (date) {
    // 日付形式 yyyy/MM/dd を yyyy-MM-dd に変換
    document.getElementById('work-date').value = date.split(' ')[0].replace(/\//g, '-');
  }
  updateDateDisplay(); 
  switchView('work');
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-title').innerText = isSignUpMode ? "KIKI SIGN UP" : "KIKI LOGIN";
  document.getElementById('auth-submit').innerText = isSignUpMode ? "REGISTER & LOGIN" : "LOGIN";
  document.getElementById('auth-toggle-btn').innerText = isSignUpMode ? "ログインはこちら" : "新規登録はこちら";
}

function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return alert("作業記録がありません");
  const targetEl = document.getElementById(`zone-card-${finalIdx}`);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetEl.classList.add('jump-highlight');
    setTimeout(() => targetEl.classList.remove('jump-highlight'), 1600);
  }
}
