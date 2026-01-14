/**
 * api.js - KIKI PRO V17 通信モジュール
 */

// 1. GASウェブアプリURL
const GAS_URL = "https://script.google.com/macros/s/AKfycbxzXaK0VJmXEy2-t6-Wd-SLIYgugDiG_gbEP49zMCoHuU52RivtJ2FYleAUyf-QKXa7rg/exec";

// 2. GAS側の SECRET_API_KEY
const SECRET_API_KEY = "kiki-secure-2026";

/**
 * GASとの通信を管理するメイン関数
 */
async function callGAS(methodName, params = {}) {
  const loader = document.getElementById('loading');
  // 通信開始時にLoadingを表示
  if (loader) loader.style.display = 'flex';

  // ペイロードの組み立て
  const payload = {
    method: methodName,
    apiKey: SECRET_API_KEY,
    data: {
      authID: params.authID || (typeof authID !== 'undefined' ? authID : ""),
      authPass: params.authPass || (typeof authPass !== 'undefined' ? authPass : ""),
      ...params
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // タイムアウトを少し延長

    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("サーバー接続エラー (" + response.status + ")");
    }

    const result = await response.json();

    if (result.status === "error") {
      throw new Error(result.message);
    }

    return result;

  } catch (error) {
    console.error("GAS Call Error:", error);
    
    let msg = error.message;
    if (error.name === 'AbortError') msg = "通信タイムアウト：電波の良い場所で再試行してください。";
    if (msg === "Failed to fetch") msg = "GASへの接続に失敗しました。";
    
    alert("【通信エラー】\n" + msg);
    throw error;

  } finally {
    // 成功・失敗に関わらずLoadingを隠す
    // ただし、app.js側の初期起動処理で制御したい場合があるため、
    // ここで消すと困る場合は app.js 側で管理する
    if (loader && methodName !== "getInitialData") {
       loader.style.display = 'none';
    }
  }
}

/**
 * ログアウト処理
 */
function logout() {
  if (confirm("ログアウトしますか？")) {
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
    location.reload();
  }
}
