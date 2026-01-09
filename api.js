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
 * 全通信でLoading表示を強制するように修正
 */
async function callGAS(methodName, params = {}) {
  // 通信開始時にLoadingオーバーレイを表示
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
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      }
    });

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
    if (error.message === "Failed to fetch") {
      throw new Error("GASへの接続に失敗しました。URLまたは公開設定を確認してください。");
    }
    throw error;
  } finally {
    // 通信終了時にLoadingを非表示（app.js側で制御が続く場合を除く）
    // ただし、ログイン後などはapp.js側の処理が終わるまで表示させたい場合があるため、
    // ここで一括で消す設定にしています。
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
