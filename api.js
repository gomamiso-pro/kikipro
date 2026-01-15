/**
 * api.js - KIKI PRO V15 通信モジュール
 */

// 1. GASウェブアプリURL (新しいデプロイ後のURLに差し替えてください)
const GAS_URL = "https://script.google.com/macros/s/AKfycbyXajffcSTwkwjcGko7LCqaS6Rz4vPIFhpwysZB7cw0Aat_4VhpamxirtSf1YlXvCHyrQ/exec";

// 2. GAS側の SECRET_API_KEY
const SECRET_API_KEY = "kiki-secure-2026";

/**
 * GASとの通信を管理するメイン関数
 */
/**
 * GASとの通信用定数
 * 新しいデプロイを作成したら必ずこのURLを更新してください
 */
const GAS_URL = "ここに新しいデプロイURLを貼り付け"; 

/**
 * callGAS: GASの関数を呼び出す
 * @param {string} func - 呼び出す関数名 (addNewRecord, getInitialData など)
 * @param {object} params - GASに渡す引数
 * @returns {promise} - パース済みのデータ
 */
async function callGAS(func, params) {
  // 通信のタイムアウトを60秒に設定
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "cors", // ブラウザの制限を回避
      headers: {
        "Content-Type": "text/plain", // GAS側の仕様に合わせる
      },
      body: JSON.stringify({
        func: func,
        params: params
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    // GASからのレスポンスを取得
    const result = await response.json();
    clearTimeout(timeoutId);

    /**
     * 【3秒切りの鍵】
     * GAS側で JSON.stringify() して返された文字列を
     * ブラウザ側で高速にパース(復元)する
     */
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch (e) {
        console.error("JSON Parse Error:", e);
        return result;
      }
    }

    return result;

  } catch (error) {
    clearTimeout(timeoutId);
    console.error("GAS Connection Error:", error);
    
    if (error.name === 'AbortError') {
      alert("通信タイムアウト：電波の良い場所で再度お試しください。");
    } else {
      alert("サーバー通信エラーが発生しました。");
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
