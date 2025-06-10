async function request(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    email: loginEmail.value,
    password: loginPassword.value
  };
  const out = await request('/login', data);
  output.textContent = JSON.stringify(out, null, 2);
});
