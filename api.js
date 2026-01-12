const GAS_URL = "https://script.google.com/macros/s/AKfycbxzXaK0VJmXEy2-t6-Wd-SLIYgugDiG_gbEP49zMCoHuU52RivtJ2FYleAUyf-QKXa7rg/exec";
const SECRET_API_KEY = "kiki-secure-2026";

async function callGAS(methodName, params = {}) {
  document.getElementById('loading').style.display = 'flex';
  const storedID = localStorage.getItem('kiki_authID') || "";
  const storedPass = localStorage.getItem('kiki_authPass') || "";

  const payload = {
    method: methodName,
    apiKey: SECRET_API_KEY,
    data: {
      authID: params.authID || storedID,
      authPass: params.authPass || storedPass,
      ...params
    }
  };

  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status === "error") throw new Error(result.message);
    return result;
  } catch (error) {
    alert("通信エラー: " + error.message);
    throw error;
  } finally {
    document.getElementById('loading').style.display = 'none';
  }
}

function logout() {
  if (confirm("ログアウトしますか？")) {
    localStorage.clear();
    location.reload();
  }
}
