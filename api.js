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
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
    return;
  }
  document.getElementById('loading').style.display = 'flex';
  try {
    authID = savedID;
    authPass = savedPass;
    const res = await callGAS("getInitialData");
    DATA = res;
    renderAll();
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    document.body.classList.add('ready');
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
  } catch (e) { 
    localStorage.clear();
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
  } finally { 
    document.getElementById('loading').style.display = 'none'; 
  }
}

function logout() {
  localStorage.clear();
  location.reload();
}
