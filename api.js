/**
 * api.js - KIKI PRO V13 通信モジュール
 */

// 1. 【重要】GASでデプロイしたウェブアプリURLをここに貼り付けてください
const GAS_URL = "https://script.google.com/macros/s/AKfycbws_EpOwxZ5g4fJoo4LAmla1HgAEpYDpTSg1otdzT0Z8F3AqHIjX3CvJ_cmM27h3HRU/exec";

// 2. 【重要】GAS側の SECRET_API_KEY と同じ文字列にしてください
const SECRET_API_KEY = "kiki-secure-2026";

// 認証情報を保持するグローバル変数
let authID = "";
let authPass = "";

/**
 * GASとの通信を管理するメイン関数
 * @param {string} methodName - GAS側で実行するメソッド名
 * @param {object} params - 送信するパラメータ
 */
async function callGAS(methodName, params = {}) {
  // GASの doPost(e) 内の request.method / request.apiKey / request.data に対応
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
        "Content-Type": "text/plain;charset=utf-8" // GASのCORS回避のための標準設定
      }
    });

    if (!response.ok) {
      throw new Error("ネットワーク応答が正常ではありません。");
    }

    const result = await response.json();

    // GAS側から {status: "error", message: "..."} が返ってきた場合の処理
    if (result.status === "error") {
      throw new Error(result.message);
    }

    return result;
  } catch (error) {
    console.error("GAS Call Error:", error);
    // Failed to fetch が出る場合は、GASの公開設定が「全員(Anyone)」か確認が必要
    if (error.message === "Failed to fetch") {
      throw new Error("GASへの接続に失敗しました。URLまたは公開設定(全員)を確認してください。");
    }
    throw error;
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
