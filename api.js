/**
 * api.js - 通信・認証管理用
 */
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbws_EpOwxZ5g4fJoo4LAmla1HgAEpYDpTSg1otdzT0Z8F3AqHIjX3CvJ_cmM27h3HRU/exec";

let authID = "";
let authPass = "";

/**
 * GASとの通信を共通化
 */
async function callGAS(method, data = {}) {
  // dataにauth情報がなければ現在の変数をセット
  if(!data.authID) data.authID = authID;
  if(!data.authPass) data.authPass = authPass;
  
  const res = await fetch(GAS_API_URL, { 
    method: "POST", 
    body: JSON.stringify({ method, data }) 
  });
  return await res.json();
}

/**
 * 起動時の自動ログイン処理
 */
async function silentLogin() {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');
  
  if (!savedID || !savedPass) {
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }

  document.getElementById('loading').style.display = 'flex';
  try {
    authID = savedID;
    authPass = savedPass;
    const res = await callGAS("getInitialData");
    
    if (res.status === "error") {
      localStorage.clear();
      location.reload(); 
      return;
    }
    
    document.getElementById('login-overlay').style.display = 'none';
    DATA = res;
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    renderAll();
  } catch (e) { 
    document.getElementById('login-overlay').style.display = 'flex';
  } finally { 
    document.getElementById('loading').style.display = 'none'; 
  }
}

/**
 * ログアウト処理
 */
function logout() {
  localStorage.clear();
  location.reload();
}
