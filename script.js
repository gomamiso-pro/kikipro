const GAS_API_URL = "https://script.google.com/macros/s/AKfycbz35ARxxw6AmCo4ZJ_EQA0NVRmSqxMp-1fCC7GtUU-MY8zjCIJ1_RkonxxspQ-uoLCpow/exec";

let DATA = {}, activeType = "通常", displayMode = "list", selectedUnits = new Set(), expandedZoneId = null, editingLogRow = null, authID = "", authPass = "", isRegisterMode = false;

const TYPE_MAP = { "通常": 3, "セル盤": 4, "計数機": 5, "ユニット": 6, "説明書": 7 }, DATE_COL_MAP = { "通常": 8, "セル盤": 9, "計数機": 10, "ユニット": 11, "説明書": 12 };

window.onload = async () => {
    const savedID = localStorage.getItem('kiki_authID'), savedPass = localStorage.getItem('kiki_authPass');
    if (savedID && savedPass) {
        authID = savedID; authPass = savedPass;
        if (!(await silentLogin())) showLoginUI();
    } else { showLoginUI(); }
    document.getElementById('work-date').value = new Date().toISOString().split('T')[0];
    updateDateDisplay();
};

const showLoginUI = () => document.getElementById('login-overlay').style.display = 'flex';
const showL = (v) => document.getElementById('loading').style.display = v ? 'flex' : 'none';

async function handleAuth() {
    const getV = (id) => document.getElementById(id).value;
    if (isRegisterMode) {
        const d = { newNick: getV('reg-nick'), newID: getV('reg-id'), newPass: getV('reg-pass') };
        if (!d.newNick || !d.newID || !d.newPass) return alert("全項目入力してください");
        showL(1);
        const res = await callGAS("registerUser", d);
        showL(0);
        if (res.status === "success") { alert(res.message); toggleAuthMode(); } else alert(res.message);
    } else {
        authID = getV('login-id'); authPass = getV('login-pass');
        const success = await silentLogin();
        if (success && document.getElementById('auto-login').checked) {
            localStorage.setItem('kiki_authID', authID); localStorage.setItem('kiki_authPass', authPass);
        }
    }
}

async function silentLogin() {
    showL(1);
    try {
        const res = await callGAS("getInitialData");
        if (res.status === "error") { localStorage.clear(); return false; }
        document.getElementById('login-overlay').style.display = 'none';
        DATA = res;
        document.getElementById('user-display').innerText = DATA.user.toUpperCase();
        const logo = document.querySelector('.user-logo');
        if (logo) logo.innerText = DATA.user.charAt(0).toUpperCase();
        renderAll(); return true;
    } catch (e) { return false; } finally { showL(0); }
}

async function callGAS(method, data = {}) {
    data.authID = authID; data.authPass = authPass;
    const res = await fetch(GAS_API_URL, { method: "POST", body: JSON.stringify({ method, data }) });
    return await res.json();
}

function renderAll() {
    const ts = ["通常", "セル盤", "計数機", "ユニット", "説明書"];
    document.getElementById('type-tabs').innerHTML = ts.map(t => `<button class="type-btn ${t === activeType ? 'active' : ''}" onclick="changeType('${t}')">${t}</button>`).join('');
    const viewWork = document.getElementById('view-work');
    if (viewWork && viewWork.style.display !== 'none') {
        displayMode === 'list' ? renderList() : renderTile();
    } else { renderLogs(); }
    updateCount();
}

function generateCardsHTML(isList) {
    const tIdx = TYPE_MAP[activeType], fIdx = getFinalWorkZoneIndex();
    return DATA.cols.map((z, i) => {
        const units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e) && (Number(m[tIdx]) === 1 || selectedUnits.has(Number(m[0]))));
        if (!units.length) return "";
        const sel = units.filter(m => selectedUnits.has(Number(m[0]))).length, lastDate = formatLastDate(z);
        const commonAttr = `id="zone-card-${i}" class="base-card ${sel > 0 ? 'has-selection' : ''} ${expandedZoneId === i ? 'expanded' : ''}" onclick="handleZoneAction(event, ${i})"`;
        const progress = `<div class="progress-container">${units.map(m => `<div class="p-seg ${selectedUnits.has(Number(m[0])) ? 'active' : ''}"></div>`).join('')}</div>`;
        const expand = `<div class="expand-box" onclick="event.stopPropagation()"><div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(${isList ? 70 : 48}px, 1fr)); gap:8px;">${units.map(m => `<div class="unit-chip ${selectedUnits.has(Number(m[0])) ? 'active' : ''}" onclick="toggleUnit(${m[0]})">${m[0]}</div>`).join('')}</div></div>`;

        return isList ? 
            `<div ${commonAttr}><div class="card-top" style="background:${z.bg}; padding:12px;"><div style="display:flex; align-items:center; gap:8px;"><div onclick="handleZoneCheck(event, ${z.s}, ${z.e})"><input type="checkbox" ${sel === units.length ? 'checked' : ''} style="width:24px; height:24px; pointer-events:none;"></div><span style="font-weight:900; font-size:22px;">${i === fIdx ? '🚩' : ''}${z.name}</span></div><span style="font-size:22px; font-weight:900;">${lastDate}</span></div><div class="card-mid" style="background:${z.bg}; padding: 0 12px 12px 12px;"><span class="f-oswald" style="font-size:40px; font-weight:900;">No.${z.s}-${z.e}</span><span class="f-oswald" style="font-size:26px; font-weight:900;">${sel} / ${units.length}</span></div>${progress}${expand}</div>` :
            `<div ${commonAttr} style="background:${z.bg};"><div class="tile-row" style="padding:4px 5px; justify-content:space-between; border-bottom:1px solid rgba(0,0,0,0.1);"><div onclick="handleZoneCheck(event, ${z.s}, ${z.e})"><input type="checkbox" ${sel === units.length ? 'checked' : ''} style="width:14px; height:14px; pointer-events:none;"></div><span style="font-size:10px; font-weight:900;">${lastDate}</span></div><div class="tile-row-center" style="font-size:11px; font-weight:900;">${i === fIdx ? '🚩' : ''}${z.name.replace('ゾーン', '')}</div><div class="tile-row-center f-oswald" style="font-size:12px; font-weight:900;">No.${z.s}-${z.e}</div><div class="tile-row-center f-oswald" style="font-size:11px; font-weight:900;">${sel}/${units.length}</div>${progress}${expand}</div>`;
    }).join('');
}

const renderList = () => { const c = document.getElementById('zone-display'); c.className = "zone-container-list"; c.innerHTML = generateCardsHTML(true); };
const renderTile = () => { const c = document.getElementById('zone-display'); c.className = "zone-container-tile"; c.innerHTML = generateCardsHTML(false); };

function formatLastDate(z) {
    const col = DATE_COL_MAP[activeType], units = DATA.master.filter(m => Number(m[0]) >= Math.min(z.s, z.e) && Number(m[0]) <= Math.max(z.s, z.e));
    let last = null; units.forEach(m => { if (m[col]) { const d = new Date(m[col]); if (!last || d > last) last = d; } });
    return last ? `${last.getMonth() + 1}/${last.getDate()}(${["日", "月", "火", "水", "木", "金", "土"][last.getDay()]})` : "未";
}

function getFinalWorkZoneIndex() {
    const col = DATE_COL_MAP[activeType]; let last = null, maxId = -1;
    DATA.master.forEach(m => { if (m[col]) { const d = new Date(m[col]); if (!last || d > last || (d.getTime() === last.getTime() && Number(m[0]) > maxId)) { last = d; maxId = Number(m[0]); } } });
    return DATA.cols.findIndex(z => maxId >= Math.min(z.s, z.e) && maxId <= Math.max(z.s, z.e));
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').innerText = isRegisterMode ? "NEW REGISTER" : "KIKI LOGIN";
    document.getElementById('login-fields').style.display = isRegisterMode ? "none" : "block";
    document.getElementById('register-fields').style.display = isRegisterMode ? "block" : "none";
    document.getElementById('auth-submit').innerText = isRegisterMode ? "新規登録" : "ログイン";
    document.getElementById('auth-toggle').innerText = isRegisterMode ? "戻る" : "こちら";
}

function handleZoneAction(e, idx) { e.stopPropagation(); expandedZoneId = (expandedZoneId === idx) ? null : idx; renderAll(); }

function handleZoneCheck(e, s, eNum) {
    e.stopPropagation(); const tIdx = TYPE_MAP[activeType];
    const ids = DATA.master.filter(m => Number(m[0]) >= Math.min(s, eNum) && Number(m[0]) <= Math.max(s, eNum) && Number(m[tIdx]) === 1).map(m => Number(m[0]));
    ids.every(id => selectedUnits.has(id)) ? ids.forEach(id => selectedUnits.delete(id)) : ids.forEach(id => selectedUnits.add(id));
    renderAll();
}

function toggleUnit(id) { selectedUnits.has(id) ? selectedUnits.delete(id) : selectedUnits.add(id); renderAll(); }
function updateCount() { document.getElementById('u-total').innerText = selectedUnits.size; document.getElementById('send-btn').disabled = !selectedUnits.size; document.getElementById('cancel-btn').style.display = selectedUnits.size ? "block" : "none"; }
function updateDateDisplay() { const d = new Date(document.getElementById('work-date').value); document.getElementById('date-label').innerText = `${d.getMonth() + 1}/${d.getDate()}(${["日", "月", "火", "水", "木", "金", "土"][d.getDay()]})`; }

function switchView(v) {
    const isWork = (v === 'work');
    document.getElementById('view-work').style.display = isWork ? 'block' : 'none';
    document.getElementById('view-log').style.display = isWork ? 'none' : 'block';
    document.getElementById('view-mode-controls').style.display = isWork ? 'block' : 'none';
    document.getElementById('tab-work').className = 'top-tab ' + (isWork ? 'active-work' : '');
    document.getElementById('tab-log').className = 'top-tab ' + (!isWork ? 'active-log' : '');
    if (!isWork) renderLogs();
}

function setMode(m) { displayMode = m; renderAll(); }
function scrollToLastWork() { const idx = getFinalWorkZoneIndex(); if (idx !== -1) document.getElementById(`zone-card-${idx}`)?.scrollIntoView({ behavior: 'smooth' }); }
function toggleAllSelection() { const tIdx = TYPE_MAP[activeType], ids = DATA.master.filter(m => Number(m[tIdx]) === 1).map(m => Number(m[0])); ids.every(id => selectedUnits.has(id)) ? selectedUnits.clear() : ids.forEach(id => selectedUnits.add(id)); renderAll(); }

async function upload() {
    showL(1);
    await callGAS("addNewRecord", { date: document.getElementById('work-date').value, type: activeType, ids: Array.from(selectedUnits), editRow: editingLogRow });
    selectedUnits.clear(); editingLogRow = null; await silentLogin(); switchView('log');
}

function renderLogs() {
    document.getElementById('log-list').innerHTML = DATA.logs.filter(l => l.type === activeType).map(l => `
    <div style="background:var(--card); padding:15px; margin-bottom:10px; border-radius:10px; border-left:5px solid var(--accent);">
      <div style="font-size:11px; color:var(--text-dim);">${l.date} (${l.day}) - ${l.user}</div>
      <div style="display:flex; justify-content:space-between; margin-top:5px;">
        <div style="font-weight:900;">${l.zone} (No.${l.s}-${l.e})</div>
        <div style="color:var(--accent); font-weight:900;">${l.count} units</div>
      </div>
      <div style="text-align:right; margin-top:10px; font-size:12px;">
        <span onclick="startEdit(${l.row},'${l.ids}','${l.date}')" style="color:var(--accent); margin-right:15px; cursor:pointer;">編集</span>
        <span onclick="handleDelete(${l.row})" style="color:var(--danger); cursor:pointer;">削除</span>
      </div>
    </div>`).join('');
}

function startEdit(row, ids, date) { editingLogRow = row; selectedUnits = new Set(ids.split(',').map(Number)); document.getElementById('work-date').value = date.replace(/\//g, '-'); switchView('work'); }
function cancelEdit() { editingLogRow = null; selectedUnits.clear(); renderAll(); }
async function handleDelete(row) { if (confirm("削除しますか？")) { showL(1); await callGAS("deleteLog", { row }); await silentLogin(); renderLogs(); } }

function showQR() {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.href)}`;
    document.getElementById('qr-target').innerHTML = `<img src="${url}" style="width:200px; border:10px solid #fff;">`;
    document.getElementById('qr-overlay').style.display = 'flex';
}

const hideQR = () => document.getElementById('qr-overlay').style.display = 'none';
const logout = () => { if (confirm("ログアウトしますか？")) { localStorage.clear(); location.reload(); } };
const closeAllDetails = (e) => { if (expandedZoneId !== null && !e.target.closest('.base-card')) { expandedZoneId = null; renderAll(); } };
