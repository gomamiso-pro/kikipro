const GAS_API_URL = "https://script.google.com/macros/s/AKfycbws_EpOwxZ5g4fJoo4LAmla1HgAEpYDpTSg1otdzT0Z8F3AqHIjX3CvJ_cmM27h3HRU/exec";
let authID = "";
let authPass = "";

async function callGAS(method, data = {}) {
  if(!data.authID) data.authID = authID;
  if(!data.authPass) data.authPass = authPass;
  try {
    const res = await fetch(GAS_API_URL, { 
      method: "POST", 
      body: JSON.stringify({ method, data }) 
    });
    const json = await res.json();
    if (json.status === "error") throw new Error(json.message);
    return json;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

async function silentLogin() {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');

  if (!savedID || !savedPass) {
    // 記憶がない場合のみログイン画面を表示
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
    return;
  }

  // 記憶がある場合は「Loading...」を出し続ける
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('login-overlay').style.display = 'none';

  try {
    authID = savedID;
    authPass = savedPass;
    const res = await callGAS("getInitialData");
    DATA = res;
    
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
    
    // データ準備完了後にアプリを表示
    document.body.classList.add('ready');
    document.getElementById('app-content').style.display = 'flex';
    document.getElementById('loading').style.display = 'none';
  } catch (e) { 
    console.error("Auto login failed:", e);
    localStorage.clear();
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login-overlay').style.display = 'flex';
  }
}

function logout() {
  localStorage.clear();
  location.reload();
}
