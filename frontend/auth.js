const TOKEN_KEY = 'election_qr_token';

function authToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  localStorage.setItem('election_qr_name', data.name || '');
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('election_qr_name');
}

function nextPath() {
  const next = new URLSearchParams(location.search).get('next') || '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//')) {
    return '/dashboard';
  }
  return next;
}

function requireAuth() {
  if (authToken()) {
    return true;
  }
  const next = encodeURIComponent(location.pathname + location.search);
  location.replace(`/login?next=${next}`);
  return false;
}

function logout() {
  clearSession();
  location.replace('/login');
}

function authHeaders(extra) {
  return {
    ...(extra || {}),
    Authorization: `Bearer ${authToken()}`,
  };
}

async function authFetch(url, options) {
  const response = await fetch(url, {
    ...(options || {}),
    headers: authHeaders(options?.headers),
  });

  if (response.status === 401) {
    clearSession();
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login?next=${next}`);
    return new Promise(() => {});
  }

  return response;
}
