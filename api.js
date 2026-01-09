/**
 * api.js - 通信・認証管理用
 */
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyCPm9p34lzDRYX_ra4mYdLrXm2pnnUJ5yn4_dO6VCtdynLLAkiH4I8jehjbV4cYIDkRg/exec";

// ★必ずGAS側の SECRET_API_KEY と一致させてください
const SECRET_API_KEY = "kiki-secure-2026"; 

let authID = "";
let authPass = "";

/**
 * GASとの通信を共通化
 */
async function callGAS(method, data = {}) {
  if(!data.authID) data.authID = authID;
  if(!data.authPass) data.authPass = authPass;
  
  try {
    const res = await fetch(GAS_API_URL, { 
      method: "POST", 
      body: JSON.stringify({ 
        method, 
        data, 
        apiKey: SECRET_API_KEY 
      }) 
    });
    
    if (!res.ok) throw new Error("Network error");
    
    const json = await res.json();
    
    // ★重要: JSONが空だったり、statusがerrorなら、ここで明示的にエラーとして扱う
    if (!json || json.status === "error") {
      throw new Error(json.message || "認証エラー");
    }
    
    return json;
  } catch (e) {
    console.error("GAS Call Error:", e);
    throw e; // エラーを投げて、呼び出し側の catchブロックに飛ばす
  }
}

/**
 * 起動時の自動ログイン処理
 */
async function silentLogin() {
  const savedID = localStorage.getItem('kiki_authID');
  const savedPass = localStorage.getItem('kiki_authPass');
  
  // ログイン情報がない場合
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
    
    if (res && res.status === "error") {
      localStorage.clear();
      location.reload(); 
      return;
    }
    
    // 1. データのセット
    DATA = res;
    
    // 2. 画面の構築を行う
    renderAll();
    document.getElementById('user-display').innerText = DATA.user.toUpperCase();
    
    // 3. 全ての構築が終わったら、bodyにreadyクラスを付けて一気に表示
    document.body.classList.add('ready');
    
    // 4. ログイン画面を消し、アプリ本体を確実に表示する
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';

  } catch (e) { 
    // ログイン失敗時はログイン画面に戻す
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
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
