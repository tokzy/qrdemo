const form = document.querySelector('#search-form');
const nameInput = document.querySelector('#name');
const referenceInput = document.querySelector('#reference');
const formError = document.querySelector('#form-error');
const count = document.querySelector('#count');
const results = document.querySelector('#results');

const params = new URLSearchParams(location.search);
nameInput.value = params.get('name') || '';
referenceInput.value = params.get('reference') || '';

function errorText(payload) {
  if (Array.isArray(payload?.message)) {
    return payload.message.join(' ');
  }
  return payload?.message || 'Request failed';
}

function money(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return '';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function when(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleString();
}

function cell(text) {
  const item = document.createElement('td');
  item.textContent = text || '—';
  return item;
}

function render(transactions) {
  count.textContent = `${transactions.length} record${
    transactions.length === 1 ? '' : 's'
  }`;
  results.replaceChildren();

  if (!transactions.length) {
    const empty = document.createElement('p');
    empty.className = 'muted empty';
    empty.textContent = 'No transactions match this search.';
    results.append(empty);
    return;
  }

  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Date', 'Name', 'Account', 'Amount', 'Status', 'Reference'].forEach((label) => {
    const item = document.createElement('th');
    item.textContent = label;
    headRow.append(item);
  });
  head.append(headRow);

  const body = document.createElement('tbody');
  transactions.forEach((transaction) => {
    const row = document.createElement('tr');
    row.append(cell(when(transaction.dateCreated)));
    row.append(cell(transaction.accountName));

    const account = document.createElement('td');
    account.textContent = transaction.accountNumber || '—';
    const bank = document.createElement('span');
    bank.className = 'muted';
    bank.textContent = transaction.bankName || '';
    account.append(document.createElement('br'), bank);
    row.append(account);

    row.append(cell(money(transaction.amount)));

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `status ${transaction.status || ''}`;
    badge.textContent = transaction.status || 'unknown';
    statusCell.append(badge);
    row.append(statusCell);

    const reference = document.createElement('td');
    reference.textContent = transaction.providerReference || 'Waiting for Fintava';
    const customer = document.createElement('span');
    customer.className = 'muted';
    customer.textContent = transaction.customerReference || '';
    reference.append(document.createElement('br'), customer);
    row.append(reference);

    body.append(row);
  });

  table.append(head, body);
  results.append(table);
}

async function loadTransactions() {
  formError.textContent = '';
  const query = new URLSearchParams();
  if (nameInput.value.trim()) {
    query.set('name', nameInput.value.trim());
  }
  if (referenceInput.value.trim()) {
    query.set('reference', referenceInput.value.trim());
  }

  const suffix = query.toString();
  const response = await authFetch(
    `/api/qrcode/transactions${suffix ? `?${suffix}` : ''}`,
  );
  const payload = await response.json();
  if (!response.ok) {
    formError.textContent = errorText(payload);
    render([]);
    return;
  }
  render(payload.data || []);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = new URLSearchParams();
  if (nameInput.value.trim()) {
    query.set('name', nameInput.value.trim());
  }
  if (referenceInput.value.trim()) {
    query.set('reference', referenceInput.value.trim());
  }
  const suffix = query.toString();
  history.replaceState(null, '', suffix ? `/transactions?${suffix}` : '/transactions');
  loadTransactions();
});

if (requireAuth()) {
  document.querySelector('#logout').addEventListener('click', logout);
  loadTransactions();
}
