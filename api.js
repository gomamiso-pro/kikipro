/**
 * api.js - KIKI PRO V16 通信モジュール
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
  if (loader) loader.style.display = 'flex';

  // ローカルストレージまたは引数から認証情報を取得
  const storedID = localStorage.getItem('kiki_authID') || "";
  const storedPass = localStorage.getItem('kiki_authPass') || "";

  const payload = {
    method: methodName,
    apiKey: SECRET_API_KEY,
    data: {
      authID: params.authID || (typeof authID !== 'undefined' ? authID : storedID),
      authPass: params.authPass || (typeof authPass !== 'undefined' ? authPass : storedPass),
      ...params
    }
  };

  try {
    // タイムアウトを25秒に設定
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

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
      throw new Error(`サーバー接続エラー (${response.status})`);
    }

    const result = await response.json();

    // GAS側でエラーが返ってきた場合
    if (result.status === "error") {
      // 認証関連のエラーであればログアウト処理
      if (result.message.includes("認証") || result.message.includes("ログイン")) {
        localStorage.removeItem('kiki_authID');
        localStorage.removeItem('kiki_authPass');
        alert("セッションが切れました。再度ログインしてください。");
        location.reload();
      }
      throw new Error(result.message);
    }

    return result;

  } catch (error) {
    console.error("GAS Call Error:", error);
    
    let msg = error.message;
    if (error.name === 'AbortError') {
      msg = "通信タイムアウト：電波の良い場所で再試行してください。";
    } else if (msg === "Failed to fetch") {
      msg = "GASへの接続に失敗しました。オフラインか、スクリプトの公開設定を確認してください。";
    }
    
    alert("【通信エラー】\n" + msg);
    throw error;

  } finally {
    // 成功・失敗に関わらずLoadingを消す
    if (loader) loader.style.display = 'none';
  }
}

/**
 * ログアウト処理
 */
function logout() {
  if (confirm("ログアウトしてログイン画面に戻りますか？")) {
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
    location.reload();
  }
}
