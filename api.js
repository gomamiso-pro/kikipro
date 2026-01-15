/**
 * api.js - KIKI PRO V15 通信モジュール
 */

// api.js の中身を以下に差し替えてください
const GAS_URL = "https://script.google.com/macros/s/AKfycbwqeriVnECgkJ-EGCQXZA_8s8mEl4cU63rBc_0Ya-jRIQhJvWCet6N5EWLD7QiFbI8jIQ/exec";
const SECRET_API_KEY = "kiki-secure-2026";

async function callGAS(func, params) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        method: func,         // GAS側の request.method に対応
        apiKey: SECRET_API_KEY, // GAS側の apiKey に対応
        data: params          // GAS側の request.data に対応
      }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    let result = await response.json();
    clearTimeout(timeoutId);

    // 文字列で届いたらオブジェクトに戻す
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch (e) { console.error("Parse error", e); }
    }

    // もしGAS側で {status: "error"} が返ってきたらアラートを出す
    if (result && result.status === "error") {
      throw new Error(result.message);
    }

    return result;

  } catch (error) {
    clearTimeout(timeoutId);
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
