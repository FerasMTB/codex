async function request(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

document.getElementById('getWorkouts').addEventListener('click', async () => {
  const res = await fetch('/workouts');
  const data = await res.json();
  workoutList.innerHTML = data.map(w => `<li>${w.id}: ${w.name} - ${w.sets}x${w.reps}</li>`).join('');
});

document.getElementById('logForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = { email: logEmail.value, workoutId: logWorkoutId.value };
  const out = await request('/log', data);
  output.textContent = JSON.stringify(out, null, 2);
});

document.getElementById('aiForm').addEventListener('submit', async e => {
  e.preventDefault();
  const out = await request('/ai-workout', { email: aiEmail.value });
  output.textContent = out.workout;
});

document.getElementById('feedbackForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = { email: fbEmail.value, feedback: fbText.value };
  const out = await request('/feedback', data);
  output.textContent = JSON.stringify(out, null, 2);
});

document.getElementById('voiceForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = { email: voiceEmail.value, transcript: voiceText.value };
  const out = await request('/voice', data);
  output.textContent = JSON.stringify(out, null, 2);
});

document.getElementById('wearableForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = { email: wearEmail.value, steps: wearSteps.value, heart_rate: wearHR.value };
  const out = await request('/wearable', data);
  output.textContent = JSON.stringify(out, null, 2);
});

document.getElementById('loadTutorials').addEventListener('click', async () => {
  const res = await fetch('/tutorials');
  const vids = await res.json();
  tutorialList.innerHTML = vids.map(v => `<li><a href="${v}">${v}</a></li>`).join('');
});

document.getElementById('shareForm').addEventListener('submit', async e => {
  e.preventDefault();
  const out = await request('/share', { email: shareEmail.value });
  output.textContent = JSON.stringify(out, null, 2);
});
