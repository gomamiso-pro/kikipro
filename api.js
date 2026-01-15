/**
 * KIKI PRO V17 - API Manager
 * GAS (Google Apps Script) との通信を制御
 */

const API_TIMEOUT = 15000; // 15秒でタイムアウト

/**
 * GASのサーバー側関数を呼び出す汎用API関数
 * @param {string} funcName - 呼び出す関数名 ('login', 'upload', 'deleteLog' など)
 * @param {object} payload - 送信するデータ
 * @returns {Promise} - サーバーからのレスポンス
 */
async function api(funcName, payload = {}) {
  return new Promise((resolve, reject) => {
    // タイムアウト監視
    const timer = setTimeout(() => {
      reject(new Error('通信タイムアウト：電波の良い場所で再試行してください'));
    }, API_TIMEOUT);

    // GASの関数を実行
    // コード.js の entryPoint(request) を呼び出す構成
    google.script.run
      .withSuccessHandler((response) => {
        clearTimeout(timer);
        
        // 文字列で返ってきた場合はパース（安全策）
        const res = typeof response === 'string' ? JSON.parse(response) : response;
        
        if (res && res.success) {
          resolve(res);
        } else {
          reject(new Error(res.message || 'サーバーエラーが発生しました'));
        }
      })
      .withFailureHandler((error) => {
        clearTimeout(timer);
        reject(new Error('システムエラー: ' + error.message));
      })
      .entryPoint({
        action: funcName,
        payload: payload
      });
  });
}

/**
 * グローバル Loading 表示制御
 * app.js からも呼び出される
 */
function showLoading() {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.display = 'flex';
    // アクセシビリティ：背後の操作を無効化
    document.body.style.pointerEvents = 'none';
  }
}

function hideLoading() {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.display = 'none';
    document.body.style.pointerEvents = 'auto';
  }
}

/**
 * 初期化時に Loading を一度リセット
 */
window.addEventListener('DOMContentLoaded', () => {
  // 初期の loading-state クラスは app.js の silentLogin 完了まで維持
});
