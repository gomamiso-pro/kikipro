/**
 * api.js - KIKI PRO V13 通信モジュール
 */

// 1. GASウェブアプリURL
const GAS_URL = "https://script.google.com/macros/s/AKfycbwTCb8e6CXka9Y6Pa4zI3MUvjQSuUTIi2ZtOeBajSbipm6bW97k9Qedo1m1VknvJVQlzQ/exec";

// 2. GAS側の SECRET_API_KEY
const SECRET_API_KEY = "kiki-secure-2026";

// 認証情報を保持するグローバル変数
let authID = "";
let authPass = "";

/**
 * GASとの通信を管理するメイン関数
 * 速度向上のため、fetchのオプションを最適化
 */
async function callGAS(methodName, params = {}) {
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';

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
    // タイムアウト設定（15秒）を追加して、無限に待たされるのを防ぐ
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error("ネットワーク応答が正常ではありません。");
    }

    const result = await response.json();

    if (result.status === "error") {
      throw new Error(result.message);
    }

    return result;
  } catch (error) {
    console.error("GAS Call Error:", error);
    if (error.name === 'AbortError') {
      throw new Error("通信がタイムアウトしました。電波の良い場所で再試行してください。");
    }
    if (error.message === "Failed to fetch") {
      throw new Error("GASへの接続に失敗しました。URLまたは公開設定を確認してください。");
    }
    throw error;
  } finally {
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
