async function request(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

document.getElementById('signupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    email: signupEmail.value,
    password: signupPassword.value,
    age: signupAge.value,
    weight: signupWeight.value,
    goals: signupGoals.value
  };
  const out = await request('/signup', data);
  output.textContent = JSON.stringify(out, null, 2);
});
