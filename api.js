const GAS_API_URL = "https://script.google.com/macros/s/AKfycbws_EpOwxZ5g4fJoo4LAmla1HgAEpYDpTSg1otdzT0Z8F3AqHIjX3CvJ_cmM27h3HRU/exec";

// 認証情報を保持するグローバル変数
let authID = "";
let authPass = "";

/**
 * Google Apps Script への通信を共通化する関数
 * @param {string} method - 実行するGASのメソッド名
 * @param {object} data - 送信するデータ
 */
async function callGAS(method, data = {}) {
  // 認証情報が引数にない場合は、保持している変数からセット
  if (!data.authID) data.authID = authID;
  if (!data.authPass) data.authPass = authPass;

  try {
    const res = await fetch(GAS_API_URL, { 
      method: "POST", 
      body: JSON.stringify({ method, data }) 
    });

    if (!res.ok) throw new Error("サーバーとの接続に失敗しました");

    const json = await res.json();

    // GAS側でエラーが返された場合（パスワード間違いなど）
    if (json.status === "error") {
      throw new Error(json.message || "予期せぬエラーが発生しました");
    }

    return json;
  } catch (e) {
    console.error("Communication Error:", e);
    // 上位（app.js）でアラート表示させるためにエラーをスロー
    throw e;
  }
}

/**
 * ログアウト処理
 * ローカルストレージを空にしてページを再読み込みする
 */
function logout() {
  if (confirm("ログアウトしてもよろしいですか？")) {
    localStorage.clear();
    location.reload();
  }
}

/**
 * 認証情報が保存されているか確認する補助関数
 */
function isUserAuthenticated() {
  return !!(localStorage.getItem('kiki_authID') && localStorage.getItem('kiki_authPass'));
}
