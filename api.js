/**
 * api.js - KIKI PRO V17 通信モジュール
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbzVAwf4OVt0NeLaNK1OPqyrriFUI9AN2vJ78QmOHdwbkndZ1Rysmp5m6WOIM_h-1GYX9w/exec";
const SECRET_API_KEY = "kiki-secure-2026";

async function callGAS(func, params) {
  // 処理開始時にLoadingを表示（全画面共通）
  const loader = document.getElementById('loading');
  if (loader) loader.style.display = 'flex';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

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

    // 文字列で届いたらオブジェクトに戻す（爆速化のための二重パース対策）
    while (typeof result === 'string') {
      result = JSON.parse(result);
    }

    if (result && result.status === "error") {
      throw new Error(result.message);
    }

    // 正常終了時は一旦ここでLoadingを隠さない（app.js側の描画完了後に隠すため）
    return result;

  } catch (error) {
    clearTimeout(timeoutId);
    if (loader) loader.style.display = 'none'; // エラー時のみ即座に隠す
    console.error("GAS Connection Error:", error);
    alert("エラー: " + error.message);
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
