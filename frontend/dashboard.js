const welcome = document.querySelector('#welcome');

if (requireAuth()) {
  document.querySelector('#logout').addEventListener('click', logout);

  authFetch('/api/auth/me')
    .then((response) => response.json())
    .then((payload) => {
      if (payload?.data?.name) {
        welcome.textContent = `Signed in as ${payload.data.name}.`;
      }
    })
    .catch(() => {
      welcome.textContent = 'Unable to load your account.';
    });
}
