const generateForm = document.querySelector('#generate-form');
const amountInput = document.querySelector('#amount');
const generateButton = document.querySelector('#generate-button');
const formError = document.querySelector('#form-error');
const preview = document.querySelector('#preview');
const qrImage = document.querySelector('#qr-image');
const previewLinks = document.querySelector('#preview-links');
const qrImageLink = document.querySelector('#qr-image-link');
const customerLink = document.querySelector('#customer-link');
const list = document.querySelector('#list');
const count = document.querySelector('#count');

function errorText(payload) {
  if (Array.isArray(payload?.message)) {
    return payload.message.join(' ');
  }
  return payload?.message || 'Request failed';
}

function statusLabel(beneficiary) {
  if (beneficiary.isPaid) return 'Paid';
  if (beneficiary.accountNumber) return 'Details received';
  return 'Waiting for details';
}

function renderPreview(data) {
  preview.querySelector('.placeholder')?.remove();
  qrImage.hidden = false;
  qrImage.src = `${data.qrImageUrl}?t=${Date.now()}`;
  previewLinks.hidden = false;
  qrImageLink.href = data.qrImageUrl;
  customerLink.href = data.url;
  preview.classList.remove('is-fresh');
  void preview.offsetWidth;
  preview.classList.add('is-fresh');
}

function renderList(beneficiaries) {
  count.textContent = `${beneficiaries.length} code${
    beneficiaries.length === 1 ? '' : 's'
  }`;
  list.replaceChildren();

  if (!beneficiaries.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No codes yet.';
    list.append(empty);
    return;
  }

  beneficiaries.forEach((beneficiary) => {
    const tile = document.createElement('article');
    tile.className = 'tile';

    const image = document.createElement('img');
    image.alt = 'QR code';
    image.src = `/api/qrcode/${beneficiary.id}/image`;

    const title = document.createElement('strong');
    title.textContent = beneficiary.accountName || 'Unassigned';

    const detail = document.createElement('p');
    detail.textContent = beneficiary.accountNumber
      ? `${beneficiary.bankName} · ${beneficiary.accountNumber}`
      : 'No account details yet';

    const badge = document.createElement('span');
    badge.className = beneficiary.accountNumber ? 'status done' : 'status';
    badge.textContent = statusLabel(beneficiary);

    tile.append(image, title, detail, badge);
    list.append(tile);
  });
}

async function loadList() {
  const response = await authFetch('/api/qrcode');
  const payload = await response.json();
  if (!response.ok) {
    list.textContent = errorText(payload);
    return;
  }
  renderList(payload.data || []);
}

generateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';
  generateButton.disabled = true;

  try {
    const response = await authFetch('/api/qrcode/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amountInput.value) }),
    });
    const payload = await response.json();

    if (!response.ok) {
      formError.textContent = errorText(payload);
      return;
    }

    renderPreview(payload.data);
    await loadList();
  } catch (error) {
    formError.textContent = 'Unable to reach the server';
  } finally {
    generateButton.disabled = false;
  }
});

if (requireAuth()) {
  document.querySelector('#logout').addEventListener('click', logout);
  loadList();
}
