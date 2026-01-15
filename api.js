/**
 * KIKI PRO V17 - API Manager
 * GAS (Google Apps Script) との通信を高速・安全に制御
 */

const API_TIMEOUT = 20000; // 現場の電波状況を考慮し20秒に設定
let isApiProcessing = false; // 二重送信防止フラグ

/**
 * GASのサーバー側関数を呼び出す汎用API関数
 * @param {string} funcName - アクション名
 * @param {object} payload - 送信データ
 * @returns {Promise}
 */
async function api(funcName, payload = {}) {
  // 二重送信防止（保存処理などの連打対策）
  if (isApiProcessing && (funcName === 'addNewRecord' || funcName === 'signUp')) {
    console.warn("API処理中のためリクエストをブロックしました:", funcName);
    return Promise.reject(new Error("処理中です。しばらくお待ちください。"));
  }

  isApiProcessing = true;
  showLoading();

  return new Promise((resolve, reject) => {
    // 1. タイムアウト監視
    const timer = setTimeout(() => {
      isApiProcessing = false;
      hideLoading();
      reject(new Error('通信タイムアウト：電波の良い場所で再試行してください'));
    }, API_TIMEOUT);

    // 2. GAS実行 (entryPoint 経由に統一)
    // payload に auth 情報が含まれていない場合は自動補完（利便性向上）
    const requestPayload = {
      ...payload,
      authID: payload.authID || localStorage.getItem('kiki_authID'),
      authPass: payload.authPass || localStorage.getItem('kiki_authPass')
    };

    google.script.run
      .withSuccessHandler((response) => {
        clearTimeout(timer);
        isApiProcessing = false;
        hideLoading();
        
        // JSON文字列で返ってきた場合のみパース
        let res = response;
        if (typeof response === 'string') {
          try { res = JSON.parse(response); } catch (e) { console.error("Parse Error", e); }
        }
        
        if (res && res.success) {
          console.log(`API Success [${funcName}]:`, res);
          resolve(res);
        } else {
          const msg = res.message || 'サーバーエラーが発生しました';
          console.error(`API Business Error [${funcName}]:`, msg);
          reject(new Error(msg));
        }
      })
      .withFailureHandler((error) => {
        clearTimeout(timer);
        isApiProcessing = false;
        hideLoading();
        console.error(`API System Error [${funcName}]:`, error);
        reject(new Error('システムエラー: ' + error.message));
      })
      .entryPoint({
        action: funcName,
        payload: requestPayload
      });
  });
}

/**
 * グローバル Loading 表示制御
 */
function showLoading() {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.display = 'flex';
    // 画面全体の操作をロック
    document.body.style.pointerEvents = 'none';
    document.body.classList.add('loading-state');
  }
}

function hideLoading() {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.display = 'none';
    // 操作ロックを解除
    document.body.style.pointerEvents = 'auto';
    document.body.classList.remove('loading-state');
  }
}

/**
 * 初期化処理
 */
window.addEventListener('DOMContentLoaded', () => {
  // 起動時のローディング表示はHTML/CSSで制御され、
  // app.js の silentLogin 完了後に hideLoading() で解除されます
});
