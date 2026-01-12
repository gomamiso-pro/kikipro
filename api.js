/**
 * api.js - KIKI PRO V15 通信モジュール
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbxzXaK0VJmXEy2-t6-Wd-SLIYgugDiG_gbEP49zMCoHuU52RivtJ2FYleAUyf-QKXa7rg/exec";
const SECRET_API_KEY = "kiki-secure-2026";

/**
 * GASとの通信を管理するメイン関数
 */
async function callGAS(methodName, params = {}) {
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';

  // ペイロード構築
  const payload = {
    method: methodName,
    apiKey: SECRET_API_KEY,
    data: {
      authID: params.authID || (typeof authID !== 'undefined' ? authID : localStorage.getItem('kiki_authID') || ""),
      authPass: params.authPass || (typeof authPass !== 'undefined' ? authPass : localStorage.getItem('kiki_authPass') || ""),
      ...params
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25秒でタイムアウト

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

    if (result.status === "error") {
      // 認証エラー時は情報をクリアしてログインへ
      if (result.message.includes("認証") || result.message.includes("ログイン")) {
        localStorage.removeItem('kiki_authID');
        localStorage.removeItem('kiki_authPass');
        alert("セッションが切れたか、認証に失敗しました。再度ログインしてください。");
        location.reload();
      }
      throw new Error(result.message);
    }

    return result;

  } catch (error) {
    console.error("GAS Call Error:", error);
    
    let msg = error.message;
    if (error.name === 'AbortError') msg = "通信タイムアウト：電波の良い場所で再試行してください。";
    if (msg === "Failed to fetch") msg = "ネットワークに接続できません。オフラインの可能性があります。";
    
    alert("【通信エラー】\n" + msg);
    throw error;

  } finally {
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
