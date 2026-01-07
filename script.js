// GASのWebアプリURL
const GAS_URL = "https://script.google.com/macros/s/AKfycby0ohoxUz-2rSI48w3VQF8WiJUkeb8Xrd4Vvec-9ylkIA-2YF_z5lA7AjY0VMNWjZgP3Q/exec";

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
