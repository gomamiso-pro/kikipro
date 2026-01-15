// --- グローバル変数 ---
let MASTER_DATA = [];
let LOG_DATA = [];
let ZONES = [];
let TYPES = [];
let CUR_USER = null;
let CUR_TYPE = "";
let VIEW_MODE = 'list'; // 'list' or 'tile'
let TEMP_DATA = {}; // { zoneId: [unit, unit...] }
let EDITING_LOG_ID = null;

// --- 初期化 ---
window.onload = async () => {
  await silentLogin();
};

// --- 認証系 ---
async function silentLogin() {
  const saved = localStorage.getItem('kiki_auth');
  if (saved) {
    const { nick, pass } = JSON.parse(saved);
    const res = await api('login', { nick, pass });
    if (res.success) {
      setupAppData(res);
      return;
    }
  }
  showLogin();
}

function showLogin() {
  document.body.classList.remove('loading-state');
  document.body.classList.add('auth-required');
  document.getElementById('loading').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value;
  const pass = document.getElementById('login-pass').value;
  if (!nick || !pass) return alert("ニックネームとパスワードを入力してください");

  showLoading();
  try {
    const res = await api('login', { nick, pass });
    if (res.success) {
      if (document.getElementById('auto-login').checked) {
        localStorage.setItem('kiki_auth', JSON.stringify({ nick, pass }));
      }
      setupAppData(res);
    } else {
      alert(res.message);
    }
  } catch (e) {
    alert("エラー: " + e.message);
  } finally {
    hideLoading();
  }
}

function setupAppData(res) {
  CUR_USER = res.user;
  MASTER_DATA = res.masterData;
  LOG_DATA = res.logData;
  ZONES = res.zones;
  TYPES = res.types;

  document.getElementById('user-display').textContent = CUR_USER.nick;
  document.body.classList.remove('loading-state', 'auth-required');
  document.body.classList.add('ready');
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-content').style.display = 'flex';

  // 初期日付セット
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('work-date').value = today;

  initTypeTabs();
  switchType(TYPES[0]);
  updateDateDisplay();
}

function logout() {
  localStorage.removeItem('kiki_auth');
  location.reload();
}

// --- タブ・表示制御 ---
function initTypeTabs() {
  const container = document.getElementById('type-tabs');
  container.innerHTML = TYPES.map(t => `
    <button class="type-btn" id="tbtn-${t}" onclick="switchType('${t}')">
      <div class="type-name-label">${t}</div>
      <div class="type-last-badge" id="last-${t}">--</div>
    </button>
  `).join('');
  updateTypeBadges();
}

function switchType(type) {
  CUR_TYPE = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tbtn-${type}`).classList.add('active');
  renderWorkView();
}

function switchView(mode) {
  const isWork = mode === 'work';
  document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
  document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
  document.getElementById('tab-work').className = isWork ? 'top-tab active-work' : 'top-tab';
  document.getElementById('tab-log').className = isWork ? '' : 'top-tab active-log';
  document.getElementById('view-mode-controls').style.display = isWork ? 'flex' : 'none';
  if (!isWork) renderLogView();
}

function setMode(m) {
  VIEW_MODE = m;
  document.getElementById('mode-list-btn').className = m === 'list' ? 'switch-btn active' : 'switch-btn';
  document.getElementById('mode-tile-btn').className = m === 'tile' ? 'switch-btn active' : 'switch-btn';
  renderWorkView();
}

// --- メイン描画ロジック ---
function renderWorkView() {
  const container = document.getElementById('zone-display');
  container.className = VIEW_MODE === 'list' ? 'zone-container-list' : 'zone-container-tile';
  
  const typeZones = ZONES.filter(z => z.type === CUR_TYPE);
  const targetDate = document.getElementById('work-date').value;

  container.innerHTML = typeZones.map(z => {
    const masterUnits = MASTER_DATA.filter(m => m.zoneId === z.id).map(m => m.unit);
    const logEntries = LOG_DATA.filter(l => l.zoneId === z.id && l.date === targetDate);
    const finishedUnits = [...new Set(logEntries.flatMap(l => l.units))];
    const tempUnits = TEMP_DATA[z.id] || [];
    
    // ゲージ生成
    const gauge = masterUnits.map(u => {
      let status = "";
      if (finishedUnits.includes(u)) status = "active";
      if (tempUnits.includes(u)) status = "active has-temp";
      return `<div class="p-seg ${status}"></div>`;
    }).join('');

    if (VIEW_MODE === 'list') {
      return `
        <div class="zone-row ${tempUnits.length > 0 ? 'has-selection' : ''}" id="zone-${z.id}" onclick="expandZone(${z.id})">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:900; font-size:16px;">${z.name}</div>
            <div class="f-oswald" style="font-size:24px; font-weight:900;">${finishedUnits.length + tempUnits.length}</div>
          </div>
          <div class="status-bar-bg">${gauge}</div>
        </div>
      `;
    } else {
      // タイル表示 (曜日なし日付 + ゾーン名 + 台数)
      return `
        <div class="tile-card ${tempUnits.length > 0 ? 'has-selection' : ''}" id="zone-${z.id}" onclick="expandZone(${z.id})">
          <div class="tile-row-1">
            <div class="tile-date-box">${formatDateWithDay(targetDate)}</div>
          </div>
          <div class="tile-row-2">${z.name}</div>
          <div class="tile-row-3">NO.${z.id}</div>
          <div class="tile-row-4">${finishedUnits.length + tempUnits.length}</div>
          <div class="status-bar-bg" style="height:4px; margin-top:2px;">${gauge}</div>
        </div>
      `;
    }
  }).join('');
  
  updateTotal();
}

// --- 展開・入力 ---
function expandZone(zId) {
  const zone = ZONES.find(z => z.id === zId);
  const masterUnits = MASTER_DATA.filter(m => m.zoneId === zId).map(m => m.unit);
  const targetDate = document.getElementById('work-date').value;
  const finishedUnits = [...new Set(LOG_DATA.filter(l => l.zoneId === zId && l.date === targetDate).flatMap(l => l.units))];
  
  const overlay = document.createElement('div');
  overlay.className = 'overlay expanded';
  overlay.id = 'expand-overlay';
  
  overlay.innerHTML = `
    <div style="font-weight:900; margin-bottom:10px; font-size:18px; color:#000;">${zone.name}</div>
    <div class="unit-grid">
      ${masterUnits.map(u => {
        const isDone = finishedUnits.includes(u);
        const isTemp = (TEMP_DATA[zId] || []).includes(u);
        return `
          <div class="unit-chip ${isDone || isTemp ? 'active' : ''}" 
               onclick="toggleUnit(this, ${zId}, ${u})" 
               style="${isDone && !isTemp ? 'opacity:0.5; pointer-events:none;' : ''}">
            ${u}
          </div>
        `;
      }).join('')}
    </div>
    <button class="btn-close-expand" onclick="closeExpand()">閉じる</button>
  `;
  document.body.appendChild(overlay);
  overlay.style.display = 'flex';
}

function toggleUnit(el, zId, unit) {
  if (!TEMP_DATA[zId]) TEMP_DATA[zId] = [];
  const idx = TEMP_DATA[zId].indexOf(unit);
  if (idx > -1) {
    TEMP_DATA[zId].splice(idx, 1);
    el.classList.remove('active');
  } else {
    TEMP_DATA[zId].push(unit);
    el.classList.add('active');
  }
  if (TEMP_DATA[zId].length === 0) delete TEMP_DATA[zId];
  renderWorkView();
}

function closeExpand() {
  const el = document.getElementById('expand-overlay');
  if (el) el.remove();
}

// --- 登録・アクション ---
async function upload() {
  if (Object.keys(TEMP_DATA).length === 0) return;
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  showLoading();

  const payload = {
    userId: CUR_USER.id,
    date: document.getElementById('work-date').value,
    type: CUR_TYPE,
    editLogId: EDITING_LOG_ID,
    data: Object.entries(TEMP_DATA).map(([zId, units]) => ({
      zoneId: parseInt(zId),
      units: units
    }))
  };

  try {
    const res = await api('upload', payload);
    if (res.success) {
      MASTER_DATA = res.masterData;
      LOG_DATA = res.logData;
      cancelEdit(); // データクリアとボタン復旧
      renderWorkView();
      updateTypeBadges();
    }
  } catch (e) {
    alert(e.message);
    btn.disabled = false;
  } finally {
    hideLoading();
  }
}

function handleZoneCheckAll() {
  const typeZones = ZONES.filter(z => z.type === CUR_TYPE);
  const targetDate = document.getElementById('work-date').value;
  let anyNew = false;

  typeZones.forEach(z => {
    const masterUnits = MASTER_DATA.filter(m => m.zoneId === z.id).map(m => m.unit);
    const finishedUnits = [...new Set(LOG_DATA.filter(l => l.zoneId === z.id && l.date === targetDate).flatMap(l => l.units))];
    const remain = masterUnits.filter(u => !finishedUnits.includes(u));
    
    if (remain.length > 0) {
      TEMP_DATA[z.id] = remain;
      anyNew = true;
    }
  });

  if (!anyNew) TEMP_DATA = {};
  renderWorkView();
}

function cancelEdit() {
  TEMP_DATA = {};
  EDITING_LOG_ID = null;
  document.getElementById('cancel-btn').style.display = 'none';
  document.getElementById('send-btn').textContent = '登録実行';
  renderWorkView();
}

// --- 履歴描画 ---
function renderLogView() {
  const container = document.getElementById('log-list');
  const sorted = [...LOG_DATA].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  container.innerHTML = sorted.map(l => {
    const zone = ZONES.find(z => z.id === l.zoneId);
    return `
      <div class="log-card">
        <div class="log-content">
          <div>
            <div class="log-main-info">${zone ? zone.name : '不明'}</div>
            <div class="log-range">${formatDateWithDay(l.date)}</div>
            <div class="log-user-info">担当: ${l.userNick} | ${l.timestamp.slice(11, 16)}</div>
          </div>
          <div class="log-unit-large">${l.units.length}</div>
        </div>
        <div class="log-action-row">
          <button class="btn-log-edit" onclick="editLog(${l.id})">編集</button>
          <button class="btn-log-del" onclick="deleteLog(${l.id})">削除</button>
        </div>
      </div>
    `;
  }).join('');
}

async function editLog(logId) {
  const log = LOG_DATA.find(l => l.id === logId);
  if (!log) return;
  
  TEMP_DATA = { [log.zoneId]: [...log.units] };
  EDITING_LOG_ID = logId;
  
  const zone = ZONES.find(z => z.id === log.zoneId);
  CUR_TYPE = zone.type;
  document.getElementById('work-date').value = log.date;
  
  switchView('work');
  switchType(CUR_TYPE);
  document.getElementById('cancel-btn').style.display = 'block';
  document.getElementById('send-btn').textContent = '更新保存';
  updateDateDisplay();
}

async function deleteLog(logId) {
  if (!confirm("この履歴を削除しますか？")) return;
  showLoading();
  try {
    const res = await api('deleteLog', { logId });
    if (res.success) {
      LOG_DATA = res.logData;
      renderLogView();
      updateTypeBadges();
    }
  } catch (e) {
    alert(e.message);
  } finally {
    hideLoading();
  }
}

// --- ユーティリティ ---
function updateTotal() {
  const targetDate = document.getElementById('work-date').value;
  const typeZones = ZONES.filter(z => z.type === CUR_TYPE);
  const zIds = typeZones.map(z => z.id);
  
  const finishedCount = [...new Set(LOG_DATA.filter(l => l.date === targetDate && zIds.includes(l.zoneId)).flatMap(l => l.units))].length;
  const tempCount = Object.entries(TEMP_DATA)
    .filter(([zId]) => zIds.includes(parseInt(zId)))
    .flatMap(([_, units]) => units).length;

  document.getElementById('u-total').textContent = finishedCount + tempCount;
  document.getElementById('send-btn').disabled = (tempCount === 0 && !EDITING_LOG_ID);
}

function updateTypeBadges() {
  TYPES.forEach(t => {
    const el = document.getElementById(`last-${t}`);
    if (!el) return;
    const typeLogs = LOG_DATA.filter(l => {
      const z = ZONES.find(zone => zone.id === l.zoneId);
      return z && z.type === t;
    });
    if (typeLogs.length > 0) {
      const latest = typeLogs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      const zone = ZONES.find(z => z.id === latest.zoneId);
      el.textContent = zone ? zone.name.slice(0,4) : '--';
    }
  });
}

function updateDateDisplay() {
  const val = document.getElementById('work-date').value;
  document.getElementById('date-label').textContent = formatDateWithDay(val);
  renderWorkView();
}

function formatDateWithDay(dateStr) {
  if (!dateStr) return "--/--(--)";
  const date = new Date(dateStr);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
}

function scrollToLastWork() {
  const typeLogs = LOG_DATA.filter(l => {
    const z = ZONES.find(zone => zone.id === l.zoneId);
    return z && z.type === CUR_TYPE;
  }).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (typeLogs.length > 0) {
    const lastId = typeLogs[0].zoneId;
    const el = document.getElementById(`zone-${lastId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('jump-highlight');
      setTimeout(() => el.classList.remove('jump-highlight'), 2000);
    }
  }
}
