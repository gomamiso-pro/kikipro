/**
 * KIKI PRO V15 - Complete Stable App Logic (Bug Fixed + Loading Optimized)
 */

// --- 1. グローバル変数の宣言 ---
let authID = localStorage.getItem('kiki_authID') || "";
let authPass = localStorage.getItem('kiki_authPass') || "";
let DATA = {};
let activeType = "通常";
let displayMode = "tile"; 
let selectedUnits = new Set();
let expandedZoneId = null;
let editingLogRow = null;
let isSignUpMode = false;

const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

// --- 2. 初期起動処理 ---
window.onload = () => {
  silentLogin(); // ここで自動ログイン判定
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
// window.onload を待たずに即実行し、裏で通信を開始する
silentLogin(); 

async function silentLogin() {
  const loader = document.getElementById('loading');
  const loginOverlay = document.getElementById('login-overlay');
  const appContent = document.getElementById('app-content');

  const storedID = localStorage.getItem('kiki_authID');
  const storedPass = localStorage.getItem('kiki_authPass');

  // 【最速判定】保存情報がない場合：すぐにLoadingを消してログイン画面を出す
  if (!storedID || !storedPass) {
    if (loader) loader.style.display = 'none';
    if (loginOverlay) loginOverlay.style.display = 'flex';
    return;
  }

  // 自動ログイン開始
  try {
    authID = storedID;
    authPass = storedPass;
    
    // GASとの通信（この間、画面には Loading だけが表示されている）
    const res = await callGAS("getInitialData");
    DATA = res;
    
    // ユーザー名をあらかじめセット
    const userDisp = document.getElementById('user-display');
    if (userDisp && DATA.user) {
      userDisp.innerText = DATA.user.toUpperCase();
    }

    // クラス切り替え
    document.body.classList.remove('loading-state');
    document.body.classList.add('ready');
    
    // メインコンテンツを表示
    if (appContent) appContent.style.display = 'block';

    renderAll();
    
  } catch (e) {
    // 認証エラー時はログイン画面へ強制移動
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
    if (loginOverlay) loginOverlay.style.display = 'flex';
  } finally {
    // 全ての描画準備が終わってから初めてLoadingを消す
    if (loader) loader.style.display = 'none';
  }
}
// --- 4. 通信を伴うアクション ---
async function upload() {
  if (selectedUnits.size === 0) return;
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';

  const idsArr = Array.from(selectedUnits).map(Number).sort((a,b)=>a-b);
  const minId = idsArr[0];

  // アプリ側でゾーン名を判定（GASに計算させないことで高速化）
  let zoneName = "選択範囲";
  if (DATA.cols) {
    const targetCol = DATA.cols.find(c => minId >= Math.min(c.s, c.e) && minId <= Math.max(c.s, c.e));
    if (targetCol) zoneName = targetCol.name;
  }

  try {
    // 1. GASへ書き込み（高速版：これ自体は1秒程度で終わる）
    await callGAS("addNewRecord", { 
      date: document.getElementById('work-date').value, 
      type: activeType, 
      ids: idsArr, 
      zone: zoneName, 
      editRow: editingLogRow 
    });

    // 2. 登録完了アラートの前にぐるぐるを消す
    if (loader) loader.style.display = 'none';
    alert("登録が完了しました");

    // 3. 【重要】最新データをバックグラウンドで再取得して🚩を更新
    const res = await callGAS("getInitialData");
    DATA = res;

    // 状態をリセットして履歴画面へ
    editingLogRow = null;
    selectedUnits.clear();
    renderAll(); // ここで🚩が新しい位置に描き直される
    switchView('log');

  } catch (e) { 
    if (loader) loader.style.display = 'none';
    alert("保存に失敗しました");
  }
}

async function handleDelete(row) { 
  if (!confirm("この履歴を削除しますか？")) return;
  
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';

  try { 
    // 1. GASで削除
    await callGAS("deleteLog", { row }); 

    // 2. 最新データを取得（これで🚩の計算元データが更新される）
    const res = await callGAS("getInitialData");
    DATA = res;
    
    // 3. 描画更新
    renderAll();
    if (loader) loader.style.display = 'none';
    alert("削除しました");
  } catch (e) {
    if (loader) loader.style.display = 'none';
    alert("削除に失敗しました");
  }
}

// --- 5. 描画ロジック ---
function renderAll() {
  if (!DATA || !DATA.cols) return;

  // タブ（種別ボタン）の生成
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  const tabContainer = document.getElementById('type-tabs');
  if (tabContainer) {
    tabContainer.innerHTML = types.map(t => {
      const lastDate = getFinalDateByType(t);
      return `<button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">
                ${t}<span class="type-last-badge">${lastDate}</span>
              </button>`;
    }).join('');
  }

  updateToggleAllBtnState();

  // ★ここを修正：displayの値を直接見て判定する
  const isLogView = (document.getElementById('view-log').style.display === 'block');

  if (isLogView) {
    renderLogs();
  } else {
    if (displayMode === 'list') {
      renderList();
    } else {
      renderTile();
    }
  }
  updateCount();
}

function renderList() {
  const container = document.getElementById('zone-display');
  if (!container) return;
  
  container.className = "zone-container-list"; 
  
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalWorkZoneIndex();
  
  const filteredZones = DATA.cols.filter(z => 
    DATA.master.some(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1)
  );

  container.innerHTML = filteredZones.map((z) => {
    const originalIdx = DATA.cols.indexOf(z);
    const zoneUnits = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && Number(m[tIdx]) === 1);
    const selCount = zoneUnits.filter(m => selectedUnits.has(Number(m[0]))).length;
    const isAll = zoneUnits.length > 0 && zoneUnits.every(m => selectedUnits.has(Number(m[0])));
    const bgColor = z.bg || z.color || "#ffffff";

    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" 
           class="zone-row ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           onclick="handleZoneAction(event, ${originalIdx})">
        
        <div style="display:flex; width:100%; align-items: stretch;">
          <div class="zone-check-area" onclick="handleZoneCheck(event, ${originalIdx})" 
               style="width: 60px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.03); border-right: 1px solid rgba(0,0,0,0.05);">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="transform: scale(1.8); pointer-events: none;">
          </div>

          <div style="background:${bgColor}; flex:1; padding: 12px 15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
              <b style="font-size:15px; color: #333;">${z.name}</b>
              <span class="f-oswald" style="font-size:13px; font-weight: 700; color: ${isFinalZone ? '#d32f2f' : '#666'};">
                ${isFinalZone ? '🚩' : ''}${formatLastDate(z)}
              </span>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
              <span class="f-oswald" style="font-size:22px; font-weight: 900; letter-spacing: -0.5px;">No.${z.s}-${z.e}</span>
              <div class="f-oswald" style="text-align: right;">
                <span style="font-size:22px; font-weight: 900;">${selCount}</span>
                <span style="font-size:14px; opacity:0.6; font-weight: 700;">/${zoneUnits.length}台</span>
              </div>
            </div>
          </div>
        </div>

        <div class="status-bar-bg" style="height:6px; background: rgba(0,0,0,0.1); display: flex;">
          ${zoneUnits.map(m => `
            <div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" 
                 style="flex:1; height:100%; border-right: 0.5px solid rgba(255,255,255,0.2);">
            </div>`).join('')}
        </div>
        
        <div class="expand-box" style="display: ${expandedZoneId === originalIdx ? 'block' : 'none'};" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(70px, 1fr)); gap:10px; padding:15px; background: rgba(255,255,255,0.7);">
            ${zoneUnits.map(m => `
              <div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" 
                   onclick="toggleUnit(${Number(m[0])})">
                ${m[0]}
              </div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)" 
                  style="width: 100%; padding: 12px; background: #444; color: #fff; border: none; font-weight: 900;">完了</button>
        </div>
      </div>`;
  }).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  if (!container) return;
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
    const rawName = z.name.replace('ゾーン', '');
    const isFinalZone = (originalIdx === finalIdx);

    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount > 0 ? 'has-selection' : ''} ${expandedZoneId === originalIdx ? 'expanded' : ''}" 
           style="background-color: ${z.color || "#ffffff"} !important;" onclick="handleZoneAction(event, ${originalIdx})">
        <div class="tile-row-1">
          <div class="check-wrapper" onclick="handleZoneCheck(event, ${originalIdx})">
            <input type="checkbox" ${isAll ? 'checked' : ''} style="pointer-events:none; transform: scale(0.75);">
          </div>
          <div class="tile-date-box ${isFinalZone ? 'is-final' : ''}">${isFinalZone ? '🚩' : ''}${formatLastDate(z, true)}</div>
        </div>
        <div class="tile-row-2"><b>${getFitSpan(rawName, 18, 70)}</b></div>
        <div class="tile-row-3 f-oswald">${getFitSpan(`No.${z.s}-${z.e}`, 18, 75)}</div>
        <div class="tile-row-4 f-oswald" style="font-size: 17px;">
          <span style="font-weight: 900;">${selCount}</span><small style="font-size:9px; opacity:0.7;">/${zoneUnits.length}</small>
        </div>
        <div class="tile-row-5 status-bar-bg">
          ${zoneUnits.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}
        </div>
        
        <div class="expand-box" style="display: ${expandedZoneId === originalIdx ? 'block' : 'none'};" onclick="event.stopPropagation()">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(70px, 1fr)); gap:10px; padding:15px; background: rgba(255,255,255,0.7);">
            ${zoneUnits.map(m => `
              <div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" 
                   onclick="toggleUnit(${Number(m[0])})">
                ${m[0]}
              </div>`).join('')}
          </div>
          <button class="btn-close-expand" onclick="closeExpand(event)" 
                  style="width: 100%; padding: 12px; background: #444; color: #fff; border: none; font-weight: 900;">完了</button>
        </div>
      </div>`;
  }).join('');
}

// --- 6. 残りのユーティリティ関数 ---
function getFitSpan(text, baseSize, limitWidth) {
  let estimatedWidth = 0;
  for (let char of String(text)) estimatedWidth += char.match(/[ -~]/) ? baseSize * 0.52 : baseSize;
  const scale = estimatedWidth > limitWidth ? limitWidth / estimatedWidth : 1;
  return `<span style="font-size:${baseSize}px; transform:scaleX(${scale}); transform-origin:left; display:inline-block; white-space:nowrap;">${text}</span>`;
}

function renderLogs() {
  const filtered = DATA.logs ? DATA.logs.filter(l => l.type === activeType) : [];
  const logList = document.getElementById('log-list');
  if(!logList) return;

  logList.innerHTML = filtered.map(l => {
    const ids = l.ids ? String(l.ids).split(',').map(Number).sort((a,b)=>a-b) : [];
    const rangeStr = ids.length > 0 ? `${ids[0]}～${ids[ids.length-1]}` : '---';
    
    // 日付に曜日を付与
    const d = new Date(l.date);
　　const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    const dayStr = ["日","月","火","水","木","金","土"][d.getDay()];
    const dateWithDay = `${dateStr}(${dayStr})`;

    return `
    <div class="log-card" style="padding: 18px; margin-bottom: 15px;">
      <div class="log-date-badge" style="font-size: 13px; margin-bottom: 8px;">${l.type} - ${dateWithDay}</div>
      
      <div class="log-content" style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="f-oswald" style="font-size: 20px; font-weight: 900; color: var(--text); line-height: 1.2;">
            ${l.zone}
          </div>
          <div class="f-oswald" style="font-size: 18px; font-weight: 700; color: var(--accent); margin-top: 4px;">
            No.${rangeStr}
          </div>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 8px; font-weight: 700;">
            👤 ${l.user || '---'}
          </div>
        </div>
        
        <div class="log-unit-large" style="text-align: right; line-height: 1;">
          ${l.count}<small style="font-size: 14px; margin-left: 2px;">台</small>
        </div>
      </div>

      <div class="log-action-row" style="display: flex; gap: 15px; margin-top: 15px;">
        <button class="btn-log-edit" 
                style="flex: 2; padding: 15px; font-size: 16px; font-weight: 900; border-radius: 10px;" 
                onclick="startEdit(${l.row}, '${l.ids}', '${l.date}', '${l.type}')">編集</button>
        <button class="btn-log-del" 
                style="flex: 1; padding: 15px; font-size: 16px; font-weight: 900; border-radius: 10px;" 
                onclick="handleDelete(${l.row})">削除</button>
      </div>
    </div>`;
  }).join('') + `<div style="height:150px;"></div>`;
}

function getFinalDateByType(type) {
  const tCol = DATE_COL_MAP[type];
  let last = null;
  if (!DATA.master) return "未";
  
  DATA.master.forEach(m => {
    if (m[tCol]) {
      const d = new Date(m[tCol]);
      if (!isNaN(d.getTime())) {
        if (!last || d > last) last = d;
      }
    }
  });
  
  if (!last) return "未";
  return `${last.getMonth() + 1}/${last.getDate()}(${["日","月","火","水","木","金","土"][last.getDay()]})`;
}

// app.js の該当箇所をこれに差し替えてください
function getFinalWorkZoneIndex() {
  const tCol = DATE_COL_MAP[activeType];
  let maxTime = -1;
  let lastId = -1;

  if (!DATA.master || !DATA.cols) return -1;

  DATA.master.forEach(m => {
    const rawValue = m[tCol];
    const id = Number(m[0]);
    
    // 値が存在し、かつIDが有効な場合のみチェック
    if (rawValue && !isNaN(id) && id > 0) {
      // どんな形式(数値、文字列)でも日付として解析を試みる
      const d = new Date(rawValue);
      const time = d.getTime();
      
      // 無効な日付(NaN)を除外し、最新(より大きい数値)を保持
      if (!isNaN(time) && time > 0) {
        if (time >= maxTime) {
          maxTime = time;
          lastId = id;
        }
      }
    }
  });

  // デバッグ用：もし🚩が出ないならコンソールでこれを確認
  console.log(`ActiveType: ${activeType}, LastID: ${lastId}, MaxTime: ${maxTime}`);

  if (lastId === -1) return -1;

  // 全ゾーンから最新IDが含まれるインデックスを返す
  return DATA.cols.findIndex(z => {
    const start = Math.min(Number(z.s), Number(z.e));
    const end = Math.max(Number(z.s), Number(z.e));
    return lastId >= start && lastId <= end;
  });
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
  if (document.getElementById('u-total')) document.getElementById('u-total').innerText = count;
  if (document.getElementById('send-btn')) document.getElementById('send-btn').disabled = (count === 0);
  if (document.getElementById('cancel-btn')) document.getElementById('cancel-btn').style.display = (count > 0 || editingLogRow) ? "block" : "none";
}

function changeType(t) {
  if (activeType === t) return;

  // 編集・選択中なら確認
  if (selectedUnits.size > 0 || editingLogRow) {
    if (!confirm("編集中の内容は破棄され、日付は今日に戻ります。よろしいですか？")) return;
  }

  activeType = t;
  resetState(); // 共通リセット実行
  renderAll();
}
function closeExpand(e) { e.stopPropagation(); expandedZoneId = null; renderAll(); }

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  if (!val) return;
  const d = new Date(val);
  const label = document.getElementById('date-label');
  if(label) label.innerText = `${d.getMonth() + 1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
}

function switchView(v) {
  const hasData = (DATA && DATA.master);
  
  // 現在の表示状態を確実に取得
  const workDisp = document.getElementById('view-work').style.display;
  const isCurrentlyWork = (workDisp === 'block' || workDisp === ''); // 初期状態も考慮

  // 切り替え先が現在と同じなら何もしない（ただしデータがない初期状態は通す）
  if (hasData) {
    if (v === 'work' && isCurrentlyWork) return;
    if (v === 'log' && workDisp === 'none') return;
  }

  // 編集中のチェック
  if (hasData && isCurrentlyWork && v === 'log' && (selectedUnits.size > 0 || editingLogRow)) {
    if (!confirm("編集中の内容は破棄され、日付は今日に戻ります。よろしいですか？")) return;
  }

  // 画面の切り替え処理
  const isWork = (v === 'work');
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('view-mode-controls').style.display = isWork ? 'flex' : 'none';
  document.getElementById('footer-content-wrap').style.display = isWork ? 'block' : 'none';
  
  // タブのクラス更新
  document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
  document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');

  // 状態のリセット（種別ボタンを押したときと同じ挙動にする）
  resetState(); 
  
  if (hasData) {
    renderAll();
  }
}
// --- app.js の formatLastDate を修正 ---
function formatLastDate(z, isShort = false) {
  const tCol = DATE_COL_MAP[activeType];
  const units = DATA.master.filter(m => {
    const id = Number(m[0]);
    return id >= Math.min(z.s, z.e) && id <= Math.max(z.s, z.e);
  });

  let maxTime = -1;
  units.forEach(m => {
    const val = m[tCol];
    if (val) {
      const time = new Date(val).getTime();
      if (!isNaN(time) && time > maxTime) maxTime = time;
    }
  });

  if (maxTime === -1) return "未";

  const d = new Date(maxTime);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const day = ["日","月","火","水","木","金","土"][d.getDay()];

  return isShort ? `${month}/${date}` : `${month}/${date}(${day})`;
}
function setMode(m) {
  if (displayMode === m) return;

  if (selectedUnits.size > 0 || editingLogRow) {
    if (!confirm("編集中の内容は破棄され、日付は今日に戻ります。よろしいですか？")) return;
  }

  displayMode = m;
  document.getElementById('mode-list-btn').classList.toggle('active', m === 'list');
  document.getElementById('mode-tile-btn').classList.toggle('active', m === 'tile');
  
  resetState(); // 共通リセット実行
  renderAll();
}

function updateToggleAllBtnState() {
  const btn = document.getElementById('toggle-all-btn');
  if (!btn) return;
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = allIds.length > 0 && allIds.every(id => selectedUnits.has(id));
  btn.innerText = isAll ? "全解除" : "全選択";
}

function handleZoneCheckAll() {
  const tIdx = TYPE_MAP[activeType];
  const allIds = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0]));
  const isAll = allIds.every(id => selectedUnits.has(id));
  allIds.forEach(id => isAll ? selectedUnits.delete(id) : selectedUnits.add(id));
  renderAll();
}

function cancelEdit() { editingLogRow = null; selectedUnits.clear(); expandedZoneId = null; renderAll(); }

function startEdit(row, ids, date, type) {
  editingLogRow = row; 
  activeType = type;

  // 1. IDリストを数値のセットに変換（空文字を除去）
  const idArray = String(ids).split(',').filter(x => x.trim() !== "").map(Number);
  selectedUnits = new Set(idArray);

  // 2. 日付をセット
  if (date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    document.getElementById('work-date').value = `${y}-${m}-${day}`;
  }
  updateDateDisplay(); 

  // 3. 表示モードを切り替え
  displayMode = 'tile';

  // 4. 【重要】まず画面を「入力」に切り替える（描画関数のガードを外すため）
  document.getElementById('view-work').style.display = 'block';
  document.getElementById('view-log').style.display = 'none';
  document.getElementById('view-mode-controls').style.display = 'flex';
  document.getElementById('footer-content-wrap').style.display = 'block';
  document.getElementById('tab-work').className = 'top-tab active-work';
  document.getElementById('tab-log').className = 'top-tab';

  // 5. 切り替わった後に描画を実行
  renderAll();
  
  // 6. 選択された台がある場所までスクロール（親切設計）
  if (idArray.length > 0) {
    setTimeout(() => {
      const firstId = idArray[0];
      const zoneIdx = DATA.cols.findIndex(z => firstId >= Math.min(z.s, z.e) && firstId <= Math.max(z.s, z.e));
      if (zoneIdx !== -1) {
        const el = document.getElementById(`zone-card-${zoneIdx}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
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

function scrollToLastWork() {
  const finalIdx = getFinalWorkZoneIndex();
  if (finalIdx === -1) return alert("データがありません");
  const targetEl = document.getElementById(`zone-card-${finalIdx}`);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetEl.classList.add('jump-highlight');
    setTimeout(() => targetEl.classList.remove('jump-highlight'), 1600);
  }
}
// 日付入力欄を今日に戻す関数
function resetToToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    dateInput.value = `${y}-${m}-${day}`;
    updateDateDisplay(); // 曜日ラベルなどの表示更新
  }
}

// 全てを真っさらな状態（今日の日付・未選択）に戻す共通処理
function resetState() {
  editingLogRow = null;
  if (selectedUnits) selectedUnits.clear(); // selectedUnitsが存在するか確認
  expandedZoneId = null;

  const dateInput = document.getElementById('work-date');
  if (dateInput) {
    const d = new Date();
    dateInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    // updateDateDisplayが存在し、かつ関数である場合のみ実行
    if (typeof updateDateDisplay === "function") {
      updateDateDisplay();
    }
  }
}
/**
 * ログイン・新規登録ボタンが押された時のメイン処理
 */
async function handleAuth() {
  const nickEl = document.getElementById('login-nick');
  const passEl = document.getElementById('login-pass');
  const loader = document.getElementById('loading');
  const autoLoginCheck = document.getElementById('auto-login');

  if (!nickEl || !passEl) return;
  
  const id = nickEl.value.trim();
  const pass = passEl.value.trim();

  // 1. 入力チェック
  if (!id || !pass) {
    alert("ニックネームとパスワードを入力してください");
    return;
  }

  // 2. ぐるぐる(Loading)を表示
  if (loader) loader.style.display = 'flex';

  try {
    authID = id;
    authPass = pass;

    // 3. モード判定（ログインか新規登録か）
    // authModeが定義されていない場合はデフォルトで "login"
    const mode = (typeof authMode !== 'undefined') ? authMode : 'login';
    
    // 4. GAS通信（データの取得 ＝ 認証）
    const res = await callGAS("getInitialData", { mode: mode });
    DATA = res;

    // 5. ログイン成功時の保存処理
    // 「次回から自動ログイン」にチェックがある場合のみ保存
    if (autoLoginCheck && autoLoginCheck.checked) {
      localStorage.setItem('kiki_authID', id);
      localStorage.setItem('kiki_authPass', pass);
    } else {
      // チェックがない場合は以前の情報を削除
      localStorage.removeItem('kiki_authID');
      localStorage.removeItem('kiki_authPass');
    }

    // 6. 【最重要】画面の切り替え
    // CSSで定義した body.ready のルールを発動させる
    document.body.classList.remove('loading-state');
    document.body.classList.add('ready');

    // 7. ユーザー名の表示更新
    const userDisp = document.getElementById('user-display');
    if (userDisp && DATA.user) {
      userDisp.innerText = DATA.user.toUpperCase();
    }

    // 8. アプリ画面の初期描画
    if (typeof resetState === 'function') resetState();
    renderAll();

  } catch (e) {
    console.error("Auth Error:", e);
    // 失敗した場合は認証情報をリセット
    authID = "";
    authPass = "";
    alert("認証に失敗しました。入力内容を確認してください。");
  } finally {
    // 9. 最後に必ずぐるぐるを消す
    if (loader) loader.style.display = 'none';
  }
}
/**
 * ログアウト処理
 */
function logout() {
  if (!confirm("ログアウトしますか？（自動ログインも解除されます）")) return;

  // 1. ローカルストレージをクリア
  localStorage.removeItem('kiki_authID');
  localStorage.removeItem('kiki_authPass');

  // 2. 認証変数をリセット
  authID = "";
  authPass = "";
  DATA = {};

  // 3. 画面表示をログイン前に戻す
  document.body.classList.remove('ready');
  document.body.classList.add('loading-state');
  
  document.getElementById('app-content').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';

  // 4. 入力フォームを空にする
  document.getElementById('login-nick').value = "";
  document.getElementById('login-pass').value = "";
}
