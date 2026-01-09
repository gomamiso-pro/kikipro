/**
 * Google Apps Script 実行用
 * @param {string} methodName - GAS側の関数名
 * @param {object} params - GASに渡す引数オブジェクト
 */

// 認証情報を保持する変数（app.jsのログイン処理で上書きされます）
let authID = "";
let authPass = "";

// GASのWebアプリURL（デプロイしたURLに差し替えてください）
const GAS_URL = "https://script.google.com/macros/s/AKfycbws_EpOwxZ5g4fJoo4LAmla1HgAEpYDpTSg1otdzT0Z8F3AqHIjX3CvJ_cmM27h3HRU/exec";

async function callGAS(methodName, params = {}) {
  // 常に最新の認証情報を付与
  const payload = {
    method: methodName,
    authID: params.authID || authID,
    authPass: params.authPass || authPass,
    ...params
  };

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("ネットワーク応答が正常ではありません");

    const result = await response.json();

    // GAS側でエラーが返された場合（例: {error: "認証失敗"}）
    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error("GAS Call Error:", error);
    // ユーザーへの通知（app.js側でcatchしてalertすることも可能）
    throw error;
  }
}

/**
 * ログアウト処理
 * ローカルストレージをクリアして再読み込み
 */
function logout() {
  if (confirm("ログアウトしますか？")) {
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
    location.reload();
  }
}
