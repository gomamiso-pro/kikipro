let DATA = {};
let activeType = "通常";
let displayMode = "tile"; 
let selectedUnits = new Set();
let isSignUpMode = false;

const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 };
const DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

window.onload = () => {
  const d = new Date();
  document.getElementById('work-date').value = d.toISOString().split('T')[0];
  updateDateDisplay();
  silentLogin();
};

async function silentLogin() {
  const id = localStorage.getItem('kiki_authID');
  if (!id) {
    document.getElementById('loading').style.display = 'none';
    return;
  }
  try {
    DATA = await callGAS("getInitialData");
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    document.getElementById('login-overlay').style.display = 'none';
    renderAll();
  } catch (e) { localStorage.clear(); }
}

async function handleAuth() {
  const nick = document.getElementById('login-nick').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  if (!nick || !pass) return;
  const method = isSignUpMode ? "signUp" : "getInitialData";
  DATA = await callGAS(method, { authID: nick, authPass: pass, nickname: nick });
  localStorage.setItem('kiki_authID', nick);
  localStorage.setItem('kiki_authPass', pass);
  document.getElementById('user-display').innerText = DATA.user.toUpperCase();
  document.getElementById('login-overlay').style.display = 'none';
  renderAll();
}

function renderAll() {
  renderTabs();
  displayMode === 'list' ? renderList() : renderTile();
  updateCount();
}

function renderTabs() {
  const types = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
  document.getElementById('type-tabs').innerHTML = types.map(t => `
    <button class="type-btn ${t===activeType?'active':''}" onclick="changeType('${t}')">
      <div>${t}</div>
    </button>`).join('');
}

function renderTile() {
  const container = document.getElementById('zone-display');
  container.className = "zone-container-tile";
  const tIdx = TYPE_MAP[activeType];
  const finalIdx = getFinalIdx();

  container.innerHTML = DATA.cols.filter(z => isVisible(z, tIdx)).map((z, i) => {
    const originalIdx = DATA.cols.indexOf(z);
    const units = getZoneUnits(z, tIdx);
    const selCount = units.filter(u => selectedUnits.has(Number(u[0]))).length;
    return `
      <div id="zone-card-${originalIdx}" class="tile-card ${selCount>0?'has-selection':''} ${originalIdx===finalIdx?'is-last':''}" onclick="openExpand(${originalIdx})">
        <div class="tile-row-1">
          <span>${originalIdx===finalIdx?'🚩':''}</span>
          <span>${formatDate(z)}</span>
        </div>
        <div class="tile-row-2">${z.name.replace('ゾーン','')}</div>
        <div class="tile-row-3">No.${z.s}-${z.e}</div>
        <div class="tile-row-4"><span>${selCount}</span><small>/${units.length}</small></div>
        <div class="status-bar-bg">${units.map(u => `<div class="p-seg ${selectedUnits.has(Number(u[0]))?'active':''}"></div>`).join('')}</div>
      </div>`;
  }).join('');
}

function openExpand(idx) {
  const z = DATA.cols[idx];
  const tIdx = TYPE_MAP[activeType];
  const units = getZoneUnits(z, tIdx);
  document.getElementById('expanded-title').innerText = `${z.name} (No.${z.s}-${z.e})`;
  document.getElementById('expanded-grid').innerHTML = units.map(u => `
    <div class="unit-chip ${selectedUnits.has(Number(u[0]))?'active':''}" onclick="toggleUnit(${u[0]})">${u[0]}</div>
  `).join('');
  document.getElementById('expanded-overlay').style.display = 'flex';
}

function toggleUnit(id) {
  selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id);
  const chips = document.querySelectorAll('.unit-chip');
  chips.forEach(c => { if(c.innerText == id) c.classList.toggle('active'); });
  updateCount();
}

function closeExpand() {
  document.getElementById('expanded-overlay').style.display = 'none';
  renderAll();
}

function updateCount() {
  const count = selectedUnits.size;
  document.getElementById('u-total').innerText = count;
  document.getElementById('send-btn').disabled = count === 0;
  document.getElementById('cancel-btn').style.display = count > 0 ? 'block' : 'none';
}

function changeType(t) { activeType = t; selectedUnits.clear(); renderAll(); }

function isVisible(z, idx) { return DATA.master.some(m => Number(m[0]) >= z.s && Number(m[0]) <= z.e && Number(m[idx]) === 1); }
function getZoneUnits(z, idx) { return DATA.master.filter(m => Number(m[0]) >= z.s && Number(m[0]) <= z.e && Number(m[idx]) === 1); }
function formatDate(z) { /* 実装略 */ return "1/13"; }
function getFinalIdx() { /* 実装略 */ return -1; }

function updateDateDisplay() {
  const d = new Date(document.getElementById('work-date').value);
  const week = ["日","月","火","水","木","金","土"];
  document.getElementById('date-label').innerText = `${d.getMonth()+1}/${d.getDate()}(${week[d.getDay()]})`;
}

async function upload() {
  await callGAS("addNewRecord", { date: document.getElementById('work-date').value, type: activeType, ids: Array.from(selectedUnits) });
  selectedUnits.clear();
  await silentLogin();
}

function setMode(m) { displayMode = m; renderAll(); }
function switchView(v) { 
  document.getElementById('view-work').style.display = v==='work'?'block':'none';
  document.getElementById('view-log').style.display = v==='log'?'block':'none';
}
