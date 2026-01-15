/**
 * api.js - KIKI PRO V17 通信モジュール
 * 2026 Stable Version / 爆速レスポンス対応
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzw6bfQrQIAM1TEYNaVRTpGgnh9TP3W4E87e3X9AasK7WJ64a0Cb2dHsAutKtNZyZpKDA/exec";
const SECRET_API_KEY = "kiki-secure-2026";

/**
 * GASとの通信を一手に引き受ける
 * @param {string} func - 呼び出すメソッド名
 * @param {object} params - GASに渡すデータ
 */
async function callGAS(func, params) {
  // 1. 通信開始時にLoadingを表示（ログイン・登録・削除すべて共通）
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 1分のタイムアウト設定

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        method: func,
        apiKey: SECRET_API_KEY,
        data: params
      }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    let result = await response.json();
    clearTimeout(timeoutId);

    // 文字列パース処理（再帰的にオブジェクト化）
    while (typeof result === 'string') {
      result = JSON.parse(result);
    }

    // GAS側からのエラー通知をキャッチ
    if (result && result.status === "error") {
      throw new Error(result.message);
    }

    /**
     * 【爆速のポイント】
     * 登録(addNewRecord)や削除(deleteLog)の場合、GAS側が既に
     * 最新の getInitialData を含んだ result を返してきているため、
     * ここでグローバル変数 DATA を更新する準備が整っています。
     */
    
    // 正常終了時はLoadingを消さずにresultを返す
    // (app.js側で描画が完了したタイミングで loader.style.display = 'none' を行うため)
    return result;

  } catch (error) {
    clearTimeout(timeoutId);
    // エラー時は即座にLoadingを隠して通知
    if (loader) loader.style.display = 'none';
    console.error("GAS Connection Error:", error);
    alert("通信エラーが発生しました: " + error.message);
    throw error;
  }
}

/**
 * ログアウト処理
 * ローカルストレージをクリアして初期画面に戻す
 */
function logout() {
  if (confirm("ログアウトしますか？")) {
    localStorage.removeItem('kiki_authID');
    localStorage.removeItem('kiki_authPass');
    location.reload();
  }
}

/**
 * Loadingを手動で隠すためのユーティリティ
 * app.jsのrenderAllなどの最後に呼び出す
 */
function hideLoader() {
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'none';
}
