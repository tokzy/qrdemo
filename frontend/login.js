const form = document.querySelector('#login-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const formError = document.querySelector('#form-error');
const loginButton = document.querySelector('#login-button');

function errorText(payload) {
  if (Array.isArray(payload?.message)) {
    return payload.message.join(' ');
  }
  return payload?.message || 'Unable to log in';
}

if (authToken()) {
  authFetch('/api/auth/me').then((response) => {
    if (response.ok) {
      location.replace(nextPath());
    }
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';
  loginButton.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      formError.textContent = errorText(payload);
      return;
    }

    saveSession(payload.data);
    location.replace(nextPath());
  } catch (error) {
    formError.textContent = 'Unable to reach the server';
  } finally {
    loginButton.disabled = false;
  }
});
