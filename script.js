// GASのWebアプリURL
const GAS_URL = "https://script.google.com/macros/s/AKfycbyUa4Uip-rHPt_Jlus1jPaw2FF5fGYSA7t22l5W8d556qIO2hXDl8YgWvHS1OL6SluGtA/exec";

function handleCredentialResponse(response) {
    // response.credential には Googleから発行されたIDトークンが入っています
    console.log("Encoded JWT ID token: " + response.credential);

    // 方法A: GASのURLにそのままリダイレクトする場合
    // window.location.href = GAS_URL;

    // 方法B: GASにデータを送信して、現在のページで処理を続ける場合
    fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors", // GASへのPOSTは基本no-cors
        body: JSON.stringify({
            token: response.credential,
            action: "login_success"
        })
    }).then(() => {
        alert("GASの処理を開始しました。");
        // 必要に応じてGASのページへ移動
        window.location.href = GAS_URL;
    }).catch(err => console.error("Error:", err));
}
