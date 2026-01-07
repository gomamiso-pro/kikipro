// GASのWebアプリURL
const GAS_URL = "https://script.google.com/macros/s/AKfycby0ohoxUz-2rSI48w3VQF8WiJUkeb8Xrd4Vvec-9ylkIA-2YF_z5lA7AjY0VMNWjZgP3Q/exec";

function callGasApp() {
    const urlWithParams = `${GAS_URL}?name=GuestUser&action=run`;

    fetch(urlWithParams, {
        method: "GET",
        mode: "no-cors" // GASへのリクエストで最もトラブルが少ない設定
    })
    .then(() => {
        // no-cors の場合、中身は読めませんが「リクエストが送られたこと」は確認できます
        alert("GASの実行リクエストを送信しました！");
    })
    .catch(error => {
        alert("エラーが発生しました。コンソールを確認してください。");
        console.error("エラー内容:", error);
    });
}
