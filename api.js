/**
 * api.js - KIKI PRO V17 通信モジュール (Fetch API)
 * 修正内容: app.jsからの呼び出しに完全対応 / エラーハンドリング強化
 */

// 1. GASウェブアプリURL (デプロイ後の最新URLを確認してください)
const GAS_URL = "https://script.google.com/macros/library/d/1r1-8GKXqqybEcawzNTnyBMoXSagGf4C2OxHki9lkIh-SgvcA4K3Ji-Yv/113";

// 2. GAS側の SECRET_API_KEY
const SECRET_API_KEY = "kiki-secure-2026";

// API処理状態フラグ (二重送信防止用)
let isApiProcessing = false;

/**
 * GASとの通信を管理するメイン関数
 * app.js から api("methodName", {data}) の形式で呼び出されます
 */
async function api(methodName, params = {}) {
  // 保存・登録処理中の連打をブロック
  if (isApiProcessing && (methodName === 'addNewRecord' || methodName === 'signUp')) {
    console.warn("API処理中のためリクエストをブロック:", methodName);
    return Promise.reject(new Error("現在処理中です。しばらくお待ちください。"));
  }

  isApiProcessing = true;
  showLoading();

  // 認証情報を localStorage または 引数から取得
  const currentAuthID = params.authID || (typeof authID !== 'undefined' ? authID : localStorage.getItem('kiki_authID'));
  const currentAuthPass = params.authPass || (typeof authPass !== 'undefined' ? authPass : localStorage.getItem('kiki_authPass'));

  const payload = {
    method: methodName,
    apiKey: SECRET_API_KEY,
    data: {
      authID: currentAuthID,
      authPass: currentAuthPass,
      ...params
    }
  };

  try {
    // タイムアウトを20秒に設定
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "cors",
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

    // GAS側からステータス "error" が返ってきた場合
    if (result.status === "error") {
      throw new Error(result.message);
    }

    console.log(`API Success [${methodName}]:`, result);
    return result;

  } catch (error) {
    console.error("GAS Call Error:", error);
    
    let msg = error.message;
    if (error.name === 'AbortError') msg = "通信タイムアウト：電波の良い場所で再試行してください。";
    if (msg === "Failed to fetch") msg = "GASへの接続に失敗しました。公開設定（全員）を確認してください。";
    
    alert("【通信エラー】\n" + msg);
    throw error;

  } finally {
    isApiProcessing = false;
    hideLoading();
  }
}

/**
 * グローバル Loading 表示制御
 */
function showLoading() {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.display = 'flex';
    document.body.style.pointerEvents = 'none'; // 操作ロック
    document.body.classList.add('loading-active');
  }
}

function hideLoading() {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.display = 'none';
    document.body.style.pointerEvents = 'auto'; // 操作解除
    document.body.classList.remove('loading-active');
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
