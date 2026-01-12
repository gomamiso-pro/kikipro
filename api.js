/**
 * api.js - KIKI PRO V15 通信モジュール
 */

// 1. GASウェブアプリURL (新しいデプロイ後のURLに差し替えてください)
const GAS_URL = "https://script.google.com/macros/s/AKfycbxzXaK0VJmXEy2-t6-Wd-SLIYgugDiG_gbEP49zMCoHuU52RivtJ2FYleAUyf-QKXa7rg/exec";

// 2. GAS側の SECRET_API_KEY
const SECRET_API_KEY = "kiki-secure-2026";

/**
 * GASとの通信を管理するメイン関数
 */
async function callGAS(methodName, params = {}) {
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';

  // ログイン済み情報をグローバルから取得（app.jsで定義されているauthID/Passを使用）
  const payload = {
    method: methodName,
    apiKey: SECRET_API_KEY,
    data: {
      authID: params.authID || authID,
      authPass: params.authPass || authPass,
      ...params
    }
  };

  try {
    // タイムアウトを20秒に設定
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "cors", // CORSを明示
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

    // GAS側でstatus: "error"が返ってきた場合
    if (result.status === "error") {
      throw new Error(result.message);
    }

    return result;

  } catch (error) {
    console.error("GAS Call Error:", error);
    
    // ユーザーにわかりやすいエラーメッセージ
    let msg = error.message;
    if (error.name === 'AbortError') msg = "通信タイムアウト：電波の良い場所で再試行してください。";
    if (msg === "Failed to fetch") msg = "GASへの接続に失敗しました。公開設定を確認してください。";
    
    alert("【通信エラー】\n" + msg);
    throw error; // app.js側の catch に流す

  } finally {
    // 成功・失敗に関わらずLoadingを必ず消す
    if (loader) loader.style.display = 'none';
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
