// GASのWebアプリURL
const GAS_URL = "https://script.google.com/macros/s/AKfycbyUa4Uip-rHPt_Jlus1jPaw2FF5fGYSA7t22l5W8d556qIO2hXDl8YgWvHS1OL6SluGtA/exec";

function callGasApp() {
    // GASに送りたいデータがあればクエリパラメータにする
    const urlWithParams = `${GAS_URL}?name=GuestUser&action=run`;

    fetch(urlWithParams, {
        method: "GET",
        mode: "cors" // ブラウザの設定によっては "no-cors"
    })
    .then(response => {
        // mode: "no-cors" の場合は中身が見えないため注意
        alert("GASを呼び出しました！");
    })
    .catch(error => {
        console.error("エラーが発生しました:", error);
    });
}
