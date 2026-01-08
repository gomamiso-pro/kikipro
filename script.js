const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwqFK7wEVWGSDOdgokNVTM5soWfKKLkKEVuQtM-18H_JEZlNmtjQVuvaAmNuxps4ekXwQ/exec";
let DATA={}, activeType="通常", displayMode="list", selectedUnits=new Set(), expandedZoneId=null, editingLogRow=null, authID="", authPass="", isRegisterMode=false;
const T_MAP={"通常":3,"セル盤":4,"計数機":5,"ユニット":6,"説明書":7}, D_MAP={"通常":8,"セル盤":9,"計数機":10,"ユニット":11,"説明書":12};

window.onload = () => {
  const sid = localStorage.getItem('kiki_authID'), spass = localStorage.getItem('kiki_authPass');
  if (sid && spass) { authID=sid; authPass=spass; silentLogin(); } 
  else { document.getElementById('login-overlay').style.display='flex'; }
  document.getElementById('work-date').value = new Date().toISOString().split('T')[0];
  updateDateDisplay();
};

async function handleAuth() {
  if (isRegisterMode) {
    const nick=document.getElementById('reg-nick').value, id=document.getElementById('reg-id').value, pass=document.getElementById('reg-pass').value;
    if(!nick||!id||!pass) return alert("入力不足");
    document.getElementById('loading').style.display='flex';
    const res = await callGAS("registerUser", { newNick:nick, newID:id, newPass:pass, authID:"guest", authPass:"guest" });
    document.getElementById('loading').style.display='none';
    if(res.status==="success") { alert(res.message); toggleAuthMode(); } else alert(res.message);
  } else {
    authID=document.getElementById('login-id').value; authPass=document.getElementById('login-pass').value;
    const ok = await silentLogin();
    if(ok && document.getElementById('auto-login').checked) { localStorage.setItem('kiki_authID',authID); localStorage.setItem('kiki_authPass',authPass); }
  }
}

async function silentLogin() {
  document.getElementById('loading').style.display='flex';
  try {
    const res = await callGAS("getInitialData");
    if(res.status==="error") { localStorage.clear(); document.getElementById('login-overlay').style.display='flex'; return false; }
    document.getElementById('login-overlay').style.display='none';
    DATA=res; document.getElementById('user-display').innerText=DATA.user.toUpperCase();
    renderAll(); return true;
  } catch(e) { return false; } finally { document.getElementById('loading').style.display='none'; }
}

async function callGAS(m, d={}) {
  d.authID=d.authID||authID; d.authPass=d.authPass||authPass;
  const r = await fetch(GAS_API_URL, {method:"POST", body:JSON.stringify({method:m, data:d})});
  return await r.json();
}

function renderAll() {
  const ts=["通常","セル盤","計数機","ユニット","説明書"];
  document.getElementById('type-tabs').innerHTML = ts.map(t=>`<button class="type-btn ${t===activeType?'active':''}" onclick="changeType('${t}')">${t}</button>`).join('');
  displayMode==='list' ? renderList() : renderTile();
  updateCount();
}

function renderList() {
  const tidx=T_MAP[activeType], fidx=getFinalIdx();
  const zones=DATA.cols.filter(z=>DATA.master.some(m=>m[0]>=Math.min(z.s,z.e)&&m[0]<=Math.max(z.s,z.e)&&m[tidx]==1));
  document.getElementById('zone-display').innerHTML = zones.map(z=>{
    const oidx=DATA.cols.indexOf(z), units=DATA.master.filter(m=>m[0]>=Math.min(z.s,z.e)&&m[0]<=Math.max(z.s,z.e)&&m[tidx]==1);
    const sel=units.filter(m=>selectedUnits.has(Number(m[0]))).length;
    return `<div id="zone-card-${oidx}" class="zone-row ${sel>0?'has-selection':''} ${expandedZoneId===oidx?'expanded':''}" onclick="expandedZoneId=(expandedZoneId===${oidx}?null:${oidx});renderAll()">
      <div class="zone-flex"><div class="zone-check-area" onclick="handleZoneCheck(event,${oidx})"><input type="checkbox" ${sel===units.length?'checked':''} disabled></div>
      <div class="zone-main" style="background:${z.bg}"><b>${z.name}</b><br><span class="f-oswald">No.${z.s}-${z.e} ${sel}/${units.length}</span></div></div>
      <div class="status-bar-bg">${units.map(m=>`<div class="p-seg ${selectedUnits.has(Number(m[0]))?'active':''}"></div>`).join('')}</div>
      <div class="expand-box">${units.map(m=>`<div class="unit-chip ${selectedUnits.has(Number(m[0]))?'active':''}" onclick="event.stopPropagation();toggleUnit(${m[0]})">${m[0]}</div>`).join('')}</div></div>`;
  }).join('');
}

function handleZoneCheck(e,idx){
  e.stopPropagation(); const z=DATA.cols[idx], tidx=T_MAP[activeType];
  const ids=DATA.master.filter(m=>m[0]>=Math.min(z.s,z.e)&&m[0]<=Math.max(z.s,z.e)&&m[tidx]==1).map(m=>Number(m[0]));
  const all=ids.every(id=>selectedUnits.has(id));
  ids.forEach(id=>all?selectedUnits.delete(id):selectedUnits.add(id)); renderAll();
}

function toggleUnit(id){ selectedUnits.has(id)?selectedUnits.delete(id):selectedUnits.add(id); renderAll(); }
function updateCount(){ document.getElementById('u-total').innerText=selectedUnits.size; document.getElementById('send-btn').disabled=selectedUnits.size===0; }
function updateDateDisplay(){ const d=new Date(document.getElementById('work-date').value); document.getElementById('date-label').innerText=`${d.getMonth()+1}/${d.getDate()}`; }
function changeType(t){ activeType=t; if(!editingLogRow)selectedUnits.clear(); renderAll(); }
function setMode(m){ displayMode=m; renderAll(); }
function toggleAuthMode(){ isRegisterMode=!isRegisterMode; document.getElementById('login-fields').style.display=isRegisterMode?'none':'block'; document.getElementById('register-fields').style.display=isRegisterMode?'block':'none'; }
function logout(){ localStorage.clear(); location.reload(); }
async function upload(){
  document.getElementById('loading').style.display='flex';
  await callGAS("addNewRecord",{date:document.getElementById('work-date').value, type:activeType, ids:Array.from(selectedUnits), editRow:editingLogRow});
  selectedUnits.clear(); editingLogRow=null; await silentLogin();
}
function getFinalIdx(){ const tcol=D_MAP[activeType]; let last=null, mid=-1; DATA.master.forEach(m=>{if(m[tcol]){const d=new Date(m[tcol]);if(!last||d>last){last=d;mid=m[0];}}}); return DATA.cols.findIndex(z=>mid>=z.s&&mid<=z.e); }
function closeAllDetails(e){ if(!e.target.closest('.zone-row')) { expandedZoneId=null; renderAll(); } }
