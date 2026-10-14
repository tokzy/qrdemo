const panel = document.querySelector('#panel');
const beneficiaryId = window.location.pathname.split('/').filter(Boolean).pop();

function errorText(payload) {
  if (Array.isArray(payload?.message)) {
    return payload.message.join(' ');
  }
  return payload?.message || 'Request failed';
}

function showMessage(text) {
  panel.replaceChildren();
  const message = document.createElement('p');
  message.className = 'muted';
  message.textContent = text;
  panel.append(message);
}

function renderSubmitted(beneficiary) {
  document.querySelector('h1').textContent = 'Details saved';
  document.querySelector('.lede').textContent =
    'This code has already been used. These details cannot be entered again.';
  panel.replaceChildren();

  const wrap = document.createElement('div');
  wrap.className = 'success';
  const mark = document.createElement('div');
  mark.className = 'mark';
  const title = document.createElement('h2');
  title.textContent = 'You are registered';
  const message = document.createElement('p');
  const ending = beneficiary.accountNumber.slice(-4);
  message.textContent = `Account ending ${ending} is saved. Payment is marked paid only after the transfer is confirmed.`;
  wrap.append(mark, title, message);
  panel.append(wrap);
}

async function renderForm() {
  panel.replaceChildren();

  const form = document.createElement('form');
  form.className = 'stack';
  form.innerHTML = `
    <label for="accountName">Account name</label>
    <input id="accountName" name="accountName" autocomplete="name" required minlength="2" maxlength="150" placeholder="Account name" />
    <label for="accountNumber">Account number</label>
    <input id="accountNumber" name="accountNumber" inputmode="numeric" autocomplete="off" required pattern="\\d{10}" maxlength="10" placeholder="10 digits" />
    <label for="bankName">Bank</label>
    <select id="bankName" name="bankName" required>
      <option value="">Loading banks…</option>
    </select>
    <p id="submit-error" class="error" role="alert"></p>
    <button type="submit">Save details</button>
  `;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    const error = form.querySelector('#submit-error');
    error.textContent = '';
    button.disabled = true;

    try {
      const response = await fetch(`/api/qrcode/${beneficiaryId}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: form.accountName.value,
          accountNumber: form.accountNumber.value,
          bankName: form.bankName.value,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        error.textContent = errorText(payload);
        button.disabled = false;
        return;
      }

      renderSubmitted(payload.data);
    } catch (requestError) {
      error.textContent = 'Unable to reach the server';
      button.disabled = false;
    }
  });

  panel.append(form);
  await loadBanks(form.querySelector('#bankName'));
}

async function loadBanks(select) {
  try {
    const response = await fetch('/api/qrcode/banks');
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.data) || !payload.data.length) {
      replaceBankSelect(select);
      return;
    }

    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a bank';
    select.append(placeholder);
    payload.data
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((bank) => {
        const option = document.createElement('option');
        option.value = bank.name;
        option.textContent = bank.name;
        select.append(option);
      });
  } catch (error) {
    replaceBankSelect(select);
  }
}

function replaceBankSelect(select) {
  const input = document.createElement('input');
  input.id = 'bankName';
  input.name = 'bankName';
  input.required = true;
  input.minLength = 2;
  input.maxLength = 150;
  input.placeholder = 'Bank name';
  select.replaceWith(input);
}

async function loadBeneficiary() {
  try {
    const response = await fetch(`/api/qrcode/${beneficiaryId}`);
    const payload = await response.json();

    if (!response.ok) {
      showMessage(errorText(payload));
      return;
    }

    if (payload.data.hasSubmittedDetails) {
      renderSubmitted(payload.data);
      return;
    }

    await renderForm();
  } catch (error) {
    showMessage('Unable to reach the server');
  }
}

loadBeneficiary();
