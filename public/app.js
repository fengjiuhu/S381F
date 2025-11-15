const state = {
  user: null,
  view: 'dashboard',
  authMode: 'login',
  dashboard: null,
  cds: [],
  library: [],
  loans: [],
  cdSearch: '',
};

const navEl = document.getElementById('nav');
const viewEl = document.getElementById('view');
const messagesEl = document.getElementById('messages');
const titleEl = document.getElementById('app-title');

async function api(path, options = {}) {
  const opts = { credentials: 'same-origin', ...options };
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.headers = { ...(opts.headers || {}), 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(opts.body);
  }
  const response = await fetch(path, opts);
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  }
  if (!response.ok) {
    const error = new Error((data && data.error) || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

function clearMessages() {
  messagesEl.innerHTML = '';
}

function showMessage(type, text) {
  const item = document.createElement('div');
  item.className = `flash ${type}`;
  item.textContent = text;
  messagesEl.appendChild(item);
  setTimeout(() => {
    item.remove();
  }, 4000);
}

function setUser(user) {
  state.user = user;
  if (!user) {
    state.view = 'dashboard';
    state.authMode = 'login';
    state.dashboard = null;
    state.cds = [];
    state.library = [];
    state.loans = [];
    state.cdSearch = '';
    renderNav();
    renderAuth();
  } else {
    state.authMode = 'login';
    state.cdSearch = '';
    state.view = user.role === 'admin' ? 'dashboard' : 'library';
    renderNav();
    loadView(state.view);
  }
}

function renderNav() {
  if (!state.user) {
    navEl.innerHTML = '';
    titleEl.textContent = 'CD Borrowing Website';
    return;
  }
  titleEl.textContent = 'CD Borrowing Website';
  navEl.innerHTML = '';
  const links = document.createElement('div');
  links.className = 'nav-links';
  const items =
    state.user.role === 'admin'
      ? [
          { view: 'dashboard', label: 'Dashboard' },
          { view: 'cds', label: 'Manage CDs' },
          { view: 'loans', label: 'All Loans' },
        ]
      : [
          { view: 'library', label: 'Library' },
          { view: 'myLoans', label: 'My Loans' },
          { view: 'account', label: 'Account' },
        ];
  items.forEach(({ view, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `nav-button${state.view === view ? ' active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (state.view !== view) {
        clearMessages();
        loadView(view);
      }
    });
    links.appendChild(btn);
  });
  navEl.appendChild(links);
  const userArea = document.createElement('div');
  userArea.className = 'nav-user';
  const chip = document.createElement('span');
  chip.className = 'user-chip';
  chip.textContent = `${state.user.displayName || state.user.username} (${state.user.role})`;
  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.className = 'nav-logout';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', handleLogout);
  userArea.appendChild(chip);
  userArea.appendChild(logoutBtn);
  navEl.appendChild(userArea);
}

function renderAuth() {
  const isRegister = state.authMode === 'register';
  titleEl.textContent = isRegister ? 'Sign up' : 'Sign in';
  viewEl.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'auth-card';
  const heading = document.createElement('h2');
  heading.textContent = isRegister ? 'Create your account' : 'Welcome back';
  const description = document.createElement('p');
  description.className = 'muted';
  description.textContent = isRegister
    ? 'Register as a library member to borrow and track CDs.'
    : 'Sign in with your account or use the admin login (admin / admin).';
  const form = document.createElement('form');
  form.className = 'form-grid';
  const userLabel = document.createElement('label');
  userLabel.textContent = 'Username';
  const userInput = document.createElement('input');
  userInput.type = 'text';
  userInput.name = 'username';
  userInput.required = true;
  userInput.autocomplete = 'username';
  const passLabel = document.createElement('label');
  passLabel.textContent = 'Password';
  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.name = 'password';
  passInput.required = true;
  passInput.autocomplete = 'current-password';
  if (isRegister) {
    passInput.autocomplete = 'new-password';
  }
  let confirmLabel;
  let confirmInput;
  let nameLabel;
  let nameInput;
  let emailLabel;
  let emailInput;
  if (isRegister) {
    nameLabel = document.createElement('label');
    nameLabel.textContent = 'Full name';
    nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.name = 'displayName';
    nameInput.required = true;

    emailLabel = document.createElement('label');
    emailLabel.textContent = 'Email';
    emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.name = 'email';
    emailInput.required = true;

    confirmLabel = document.createElement('label');
    confirmLabel.textContent = 'Confirm password';
    confirmInput = document.createElement('input');
    confirmInput.type = 'password';
    confirmInput.name = 'confirm';
    confirmInput.required = true;
    confirmInput.autocomplete = 'new-password';
  }
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button';
  submit.textContent = isRegister ? 'Create account' : 'Sign in';
  form.appendChild(userLabel);
  form.appendChild(userInput);
  form.appendChild(passLabel);
  form.appendChild(passInput);
  if (isRegister) {
    form.appendChild(nameLabel);
    form.appendChild(nameInput);
    form.appendChild(emailLabel);
    form.appendChild(emailInput);
    form.appendChild(confirmLabel);
    form.appendChild(confirmInput);
  }
  form.appendChild(submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        username: userInput.value.trim(),
        password: passInput.value,
      };
      if (isRegister) {
        if (passInput.value !== confirmInput.value) {
          showMessage('error', 'Passwords do not match.');
          return;
        }
        payload.confirm = confirmInput.value;
        payload.displayName = nameInput.value.trim();
        payload.email = emailInput.value.trim();
      }
      const endpoint = isRegister ? '/api/register' : '/api/login';
      const result = await api(endpoint, { method: 'POST', body: payload });
      const greeting = isRegister ? 'Account created for' : 'Welcome back';
      showMessage('success', `${greeting} ${result.user.username}`);
      setUser(result.user);
    } catch (error) {
      showMessage('error', error.message);
    }
  });
  card.appendChild(heading);
  card.appendChild(description);
  card.appendChild(form);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'link-button';
  toggle.textContent = isRegister ? 'Have an account? Sign in' : 'Need an account? Sign up';
  toggle.addEventListener('click', () => {
    state.authMode = isRegister ? 'login' : 'register';
    clearMessages();
    renderAuth();
  });
  card.appendChild(toggle);
  viewEl.appendChild(card);
  userInput.focus();
}

async function handleLogout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (error) {}
  clearMessages();
  showMessage('info', 'Signed out');
  setUser(null);
}

async function loadView(view) {
  if (!state.user) return;
  state.view = view;
  renderNav();
  viewEl.innerHTML = '<p class="muted">Loading...</p>';
  try {
    if (state.user.role === 'admin') {
      if (view === 'dashboard') {
        state.dashboard = await api('/api/dashboard');
        renderDashboard();
      } else if (view === 'cds') {
        const [cds, library] = await Promise.all([api('/api/cds'), api('/api/library')]);
        state.cds = cds;
        state.library = library;
        renderAdminLibrary();
      } else if (view === 'loans') {
        state.loans = await api('/api/loans');
        renderAdminLoans();
      }
    } else {
      if (view === 'library') {
        const [library, myLoans] = await Promise.all([
          api('/api/library'),
          api('/api/loans'),
        ]);
        state.library = library;
        state.loans = myLoans;
        renderMemberLibrary();
      } else if (view === 'myLoans') {
        state.loans = await api('/api/loans');
        renderMemberLoans();
      } else if (view === 'account') {
        state.loans = await api('/api/loans');
        renderAccount();
      }
    }
  } catch (error) {
    if (error.status === 401) {
      showMessage('error', 'Please sign in to continue.');
      setUser(null);
    } else {
      showMessage('error', error.message);
    }
  }
}

function renderDashboard() {
  if (!state.dashboard) return;
  viewEl.innerHTML = '';
  const wrapper = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'section-header';
  const title = document.createElement('h2');
  title.textContent = 'Overview';
  header.appendChild(title);
  wrapper.appendChild(header);
  const cards = document.createElement('div');
  cards.className = 'cards';
  const entries = [
    { label: 'CD Titles', value: state.dashboard.stats.totalCDs },
    { label: 'Available Copies', value: state.dashboard.stats.availableCopies },
    { label: 'Active Loans', value: state.dashboard.stats.activeLoans },
    { label: 'Total Loans', value: state.dashboard.stats.totalLoans },
  ];
  entries.forEach((entry) => {
    const card = document.createElement('div');
    card.className = 'card';
    const value = document.createElement('p');
    value.className = 'stat-value';
    value.textContent = entry.value;
    const label = document.createElement('span');
    label.className = 'muted';
    label.textContent = entry.label;
    card.appendChild(value);
    card.appendChild(label);
    cards.appendChild(card);
  });
  wrapper.appendChild(cards);
  const recentHeader = document.createElement('h3');
  recentHeader.className = 'section-subtitle';
  recentHeader.textContent = 'Recently added CDs';
  wrapper.appendChild(recentHeader);
  if (!state.dashboard.recentCDs.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Add CDs to see them here.';
    wrapper.appendChild(empty);
  } else {
    const list = document.createElement('ul');
    list.className = 'recent-list';
    state.dashboard.recentCDs.forEach((cd) => {
      const item = document.createElement('li');
      const titleText = document.createElement('strong');
      titleText.textContent = cd.title;
      const meta = document.createElement('span');
      meta.className = 'muted';
      meta.textContent = ` ${cd.artist} • ${cd.genre} • ${cd.year}`;
      item.appendChild(titleText);
      item.appendChild(meta);
      list.appendChild(item);
    });
    wrapper.appendChild(list);
  }
  viewEl.appendChild(wrapper);
}

function renderAdminLibrary() {
  viewEl.innerHTML = '';
  const wrapper = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'section-header';
  const title = document.createElement('h2');
  title.textContent = 'CD Library Management';
  header.appendChild(title);
  wrapper.appendChild(header);
  const form = document.createElement('form');
  form.className = 'form-grid two-column';
  form.innerHTML = `
    <label>Title<input name="title" required /></label>
    <label>Artist<input name="artist" required /></label>
    <label>Genre<input name="genre" required /></label>
    <label>Year<input name="year" type="number" min="1900" max="2100" required /></label>
    <label>Total copies<input name="totalCopies" type="number" min="1" required /></label>
    <div class="form-actions"><button type="submit" class="button">Add CD</button></div>
  `;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await api('/api/cds', { method: 'POST', body: data });
      showMessage('success', 'CD added to the library.');
      form.reset();
      await loadView('cds');
    } catch (error) {
      showMessage('error', error.message);
    }
  });
  wrapper.appendChild(form);
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search by title, artist, or genre';
  search.value = state.cdSearch;
  search.addEventListener('input', () => {
    state.cdSearch = search.value;
    renderCDList(listContainer);
  });
  wrapper.appendChild(search);
  const listContainer = document.createElement('div');
  wrapper.appendChild(listContainer);
  renderCDList(listContainer);
  viewEl.appendChild(wrapper);
}

function renderCDList(container) {
  container.innerHTML = '';
  const query = state.cdSearch.trim().toLowerCase();
  const filtered = state.cds
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .filter((cd) => {
      if (!query) return true;
      return [cd.title, cd.artist, cd.genre].some((field) =>
        (field || '').toLowerCase().includes(query),
      );
    });
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = query ? 'No CDs match your search.' : 'Add your first CD to get started.';
    container.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'table';
  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr><th>Title</th><th>Artist</th><th>Genre</th><th>Year</th><th>Copies</th><th>Loans</th><th>Actions</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  filtered.forEach((cd) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${cd.title}</td>
      <td>${cd.artist}</td>
      <td>${cd.genre}</td>
      <td>${cd.year}</td>
      <td></td>
      <td></td>
      <td></td>
    `;
    const copiesCell = row.children[4];
    const badge = document.createElement('span');
    badge.className = `badge ${cd.availableCopies > 0 ? 'available' : 'unavailable'}`;
    badge.textContent = cd.availableCopies > 0 ? 'Available' : 'Out';
    const copyText = document.createElement('span');
    copyText.textContent = ` ${cd.availableCopies} / ${cd.totalCopies}`;
    copiesCell.appendChild(badge);
    copiesCell.appendChild(copyText);
    const loanCell = row.children[5];
    const related = state.library.find((entry) => entry._id === cd._id) || { activeLoans: [] };
    if (related.activeLoans.length === 0) {
      loanCell.innerHTML = '<span class="muted">No active loans</span>';
    } else {
      const list = document.createElement('ul');
      list.className = 'loan-badges';
      related.activeLoans.forEach((loan) => {
        const item = document.createElement('li');
        item.innerHTML = `
          <strong>${loan.borrowerName}</strong>
          <span class="muted"> · Due ${formatDate(loan.dueAt)}</span>
          ${loan.daysRemaining < 0 ? '<span class="badge danger">Overdue</span>' : ''}
        `;
        list.appendChild(item);
      });
      loanCell.appendChild(list);
    }
    const actions = document.createElement('div');
    actions.className = 'actions';
    const borrowBtn = document.createElement('button');
    borrowBtn.type = 'button';
    borrowBtn.className = 'button small success';
    borrowBtn.textContent = 'Borrow';
    borrowBtn.disabled = cd.availableCopies === 0;
    borrowBtn.addEventListener('click', () => handleBorrow(cd));
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'button small secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => handleEditCD(cd));
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'button small danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => handleDeleteCD(cd));
    actions.appendChild(borrowBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    row.children[6].appendChild(actions);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderMemberLibrary() {
  viewEl.innerHTML = '';
  const wrapper = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'section-header';
  const title = document.createElement('h2');
  title.textContent = 'Browse the CD Collection';
  header.appendChild(title);
  wrapper.appendChild(header);
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search by title, artist, or genre';
  search.value = state.cdSearch;
  search.addEventListener('input', () => {
    state.cdSearch = search.value;
    renderMemberCdList(listContainer);
  });
  wrapper.appendChild(search);
  const listContainer = document.createElement('div');
  wrapper.appendChild(listContainer);
  renderMemberCdList(listContainer);
  viewEl.appendChild(wrapper);
}

function renderMemberCdList(container) {
  container.innerHTML = '';
  const query = state.cdSearch.trim().toLowerCase();
  const cds = state.library.slice().sort((a, b) => a.title.localeCompare(b.title));
  const filtered = cds.filter((cd) => {
    if (!query) return true;
    return [cd.title, cd.artist, cd.genre].some((field) => (field || '').toLowerCase().includes(query));
  });
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = query ? 'No CDs match your search.' : 'No CDs available yet.';
    container.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'table';
  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr><th>Title</th><th>Artist</th><th>Genre</th><th>Availability</th><th>Next due</th><th>Actions</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  filtered.forEach((cd) => {
    const row = document.createElement('tr');
    const nextLoan = cd.activeLoans
      .slice()
      .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0))[0];
    const myLoan = cd.activeLoans.find((loan) => loan.userId === state.user._id);
    const detailedMyLoan = myLoan
      ? state.loans.find((loan) => loan._id === myLoan._id) || myLoan
      : null;
    const availabilityBadge = document.createElement('span');
    availabilityBadge.className = `badge ${cd.availableCopies > 0 ? 'available' : 'unavailable'}`;
    availabilityBadge.textContent = cd.availableCopies > 0 ? 'Available' : 'Unavailable';
    row.innerHTML = `
      <td>${cd.title}</td>
      <td>${cd.artist}</td>
      <td>${cd.genre}</td>
      <td></td>
      <td>${nextLoan ? formatDate(nextLoan.dueAt) : '—'}</td>
      <td></td>
    `;
    const availabilityCell = row.children[3];
    availabilityCell.appendChild(availabilityBadge);
    const copyInfo = document.createElement('span');
    copyInfo.className = 'muted';
    copyInfo.textContent = ` ${cd.availableCopies} of ${cd.totalCopies} copies`;
    availabilityCell.appendChild(copyInfo);
    if (cd.activeLoans.length) {
      const borrowers = document.createElement('div');
      borrowers.className = 'muted';
      borrowers.textContent = `${cd.activeLoans.length} active loan${cd.activeLoans.length === 1 ? '' : 's'}`;
      availabilityCell.appendChild(borrowers);
    }
    const dueCell = row.children[4];
    if (nextLoan) {
      const days = nextLoan.daysRemaining;
      const hint = document.createElement('div');
      hint.className = 'muted';
      if (typeof days === 'number') {
        if (days < 0) {
          hint.textContent = `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
          dueCell.appendChild(hint);
        } else {
          hint.textContent = `${days} day${days === 1 ? '' : 's'} remaining`;
          dueCell.appendChild(hint);
        }
      }
    }
    const actions = document.createElement('div');
    actions.className = 'actions';
    if (detailedMyLoan) {
      const returnBtn = document.createElement('button');
      returnBtn.type = 'button';
      returnBtn.className = 'button small danger';
      returnBtn.textContent = 'Return';
      returnBtn.addEventListener('click', () => handleReturnLoan(detailedMyLoan, 'library'));
      const renewBtn = document.createElement('button');
      renewBtn.type = 'button';
      renewBtn.className = 'button small secondary';
      renewBtn.textContent = 'Renew';
      renewBtn.disabled = (detailedMyLoan.renewalsUsed || 0) >= (detailedMyLoan.maxRenewals ?? 1);
      renewBtn.addEventListener('click', () => handleRenewLoan(detailedMyLoan, 'library'));
      actions.appendChild(returnBtn);
      actions.appendChild(renewBtn);
    } else {
      const borrowBtn = document.createElement('button');
      borrowBtn.type = 'button';
      borrowBtn.className = 'button small success';
      borrowBtn.textContent = 'Borrow';
      borrowBtn.disabled = cd.availableCopies === 0;
      borrowBtn.addEventListener('click', () => handleMemberBorrow(cd));
      actions.appendChild(borrowBtn);
    }
    row.children[5].appendChild(actions);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

async function handleBorrow(cd) {
  const borrowerName = window.prompt('Borrower name');
  if (!borrowerName) return;
  const borrowerEmail = window.prompt('Borrower email');
  if (!borrowerEmail) return;
  try {
    await api(`/api/cds/${cd._id}/borrow`, {
      method: 'POST',
      body: { borrowerName, borrowerEmail },
    });
    showMessage('success', `${borrowerName} borrowed ${cd.title}.`);
    await loadView('cds');
  } catch (error) {
    showMessage('error', error.message);
  }
}

async function handleMemberBorrow(cd) {
  try {
    await api(`/api/cds/${cd._id}/borrow`, { method: 'POST' });
    showMessage('success', `You borrowed ${cd.title}.`);
    await loadView('library');
  } catch (error) {
    showMessage('error', error.message);
  }
}

async function handleEditCD(cd) {
  const title = window.prompt('Title', cd.title);
  if (!title) return;
  const artist = window.prompt('Artist', cd.artist);
  if (!artist) return;
  const genre = window.prompt('Genre', cd.genre);
  if (!genre) return;
  const year = window.prompt('Year', cd.year);
  const totalCopies = window.prompt('Total copies', cd.totalCopies);
  const availableCopies = window.prompt('Available copies', cd.availableCopies);
  try {
    await api(`/api/cds/${cd._id}`, {
      method: 'PUT',
      body: { title, artist, genre, year, totalCopies, availableCopies },
    });
    showMessage('success', `${title} updated.`);
    await loadView('cds');
  } catch (error) {
    showMessage('error', error.message);
  }
}

async function handleDeleteCD(cd) {
  const confirmed = window.confirm(`Delete ${cd.title}? This removes its loan history.`);
  if (!confirmed) return;
  try {
    await api(`/api/cds/${cd._id}`, { method: 'DELETE' });
    showMessage('info', `${cd.title} removed.`);
    await loadView('cds');
  } catch (error) {
    showMessage('error', error.message);
  }
}

function renderAdminLoans() {
  viewEl.innerHTML = '';
  const wrapper = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'section-header';
  const title = document.createElement('h2');
  title.textContent = 'Loans';
  header.appendChild(title);
  wrapper.appendChild(header);
  const loans = state.loans || [];
  const active = loans.filter((loan) => loan.status === 'borrowed');
  const history = loans.filter((loan) => loan.status === 'returned');
  const activeSection = document.createElement('section');
  const activeTitle = document.createElement('h3');
  activeTitle.className = 'section-subtitle';
  activeTitle.textContent = 'Active loans';
  activeSection.appendChild(activeTitle);
  activeSection.appendChild(createAdminLoanTable(active, true));
  const historySection = document.createElement('section');
  const historyTitle = document.createElement('h3');
  historyTitle.className = 'section-subtitle';
  historyTitle.textContent = 'Loan history';
  historySection.appendChild(historyTitle);
  historySection.appendChild(createAdminLoanTable(history, false));
  wrapper.appendChild(activeSection);
  wrapper.appendChild(historySection);
  viewEl.appendChild(wrapper);
}

function createAdminLoanTable(loans, allowReturn) {
  if (!loans.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = allowReturn ? 'No active loans.' : 'No loan history yet.';
    return empty;
  }
  const table = document.createElement('table');
  table.className = 'table';
  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr><th>Borrower</th><th>CD</th><th>Borrowed</th><th>Due</th><th>Status</th><th>Renewals</th><th>Actions</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  loans.forEach((loan) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${loan.borrowerName}<div class="muted">${loan.borrowerEmail}</div></td>
      <td>${loan.cdTitle}</td>
      <td>${formatDate(loan.borrowedAt)}</td>
      <td>${formatDate(loan.dueAt)}</td>
      <td></td>
      <td>${loan.renewalsUsed || 0} / ${loan.maxRenewals ?? 1}</td>
      <td></td>
    `;
    const statusCell = row.children[4];
    const badge = document.createElement('span');
    if (loan.status === 'borrowed') {
      const overdue = loan.daysRemaining < 0;
      badge.className = `badge ${overdue ? 'danger' : 'available'}`;
      badge.textContent = overdue
        ? `Overdue by ${Math.abs(loan.daysRemaining)} day${Math.abs(loan.daysRemaining) === 1 ? '' : 's'}`
        : `Due in ${loan.daysRemaining ?? '?'} day${loan.daysRemaining === 1 ? '' : 's'}`;
    } else {
      badge.className = 'badge secondary';
      badge.textContent = `Returned ${formatDate(loan.returnedAt)}`;
    }
    statusCell.appendChild(badge);
    const actionsCell = row.children[6];
    const actions = document.createElement('div');
    actions.className = 'actions';
    if (allowReturn) {
      const returnBtn = document.createElement('button');
      returnBtn.type = 'button';
      returnBtn.className = 'button small success';
      returnBtn.textContent = 'Mark returned';
      returnBtn.addEventListener('click', () => handleReturnLoan(loan));
      actions.appendChild(returnBtn);
    }
    actionsCell.appendChild(actions);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function renderMemberLoans() {
  viewEl.innerHTML = '';
  const wrapper = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'section-header';
  const title = document.createElement('h2');
  title.textContent = 'My Loans';
  header.appendChild(title);
  wrapper.appendChild(header);
  const loans = state.loans || [];
  const active = loans.filter((loan) => loan.status === 'borrowed');
  const history = loans.filter((loan) => loan.status === 'returned');
  const activeSection = document.createElement('section');
  const activeTitle = document.createElement('h3');
  activeTitle.className = 'section-subtitle';
  activeTitle.textContent = 'Active loans';
  activeSection.appendChild(activeTitle);
  activeSection.appendChild(createMemberLoanTable(active, true));
  const historySection = document.createElement('section');
  const historyTitle = document.createElement('h3');
  historyTitle.className = 'section-subtitle';
  historyTitle.textContent = 'Loan history';
  historySection.appendChild(historyTitle);
  historySection.appendChild(createMemberLoanTable(history, false));
  wrapper.appendChild(activeSection);
  wrapper.appendChild(historySection);
  viewEl.appendChild(wrapper);
}

function createMemberLoanTable(loans, allowActions) {
  if (!loans.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = allowActions ? 'You have no active loans.' : 'You have not borrowed any CDs yet.';
    return empty;
  }
  const table = document.createElement('table');
  table.className = 'table';
  const thead = document.createElement('thead');
  thead.innerHTML =
    '<tr><th>CD</th><th>Borrowed</th><th>Due</th><th>Status</th><th>Renewals</th><th>Actions</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  loans.forEach((loan) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${loan.cdTitle}</td>
      <td>${formatDate(loan.borrowedAt)}</td>
      <td>${formatDate(loan.dueAt)}</td>
      <td></td>
      <td>${loan.renewalsUsed || 0} / ${loan.maxRenewals ?? 1}</td>
      <td></td>
    `;
    const statusCell = row.children[3];
    const badge = document.createElement('span');
    if (loan.status === 'borrowed') {
      const overdue = loan.daysRemaining < 0;
      badge.className = `badge ${overdue ? 'danger' : 'available'}`;
      badge.textContent = overdue
        ? `Overdue by ${Math.abs(loan.daysRemaining)} day${Math.abs(loan.daysRemaining) === 1 ? '' : 's'}`
        : `${loan.daysRemaining ?? '?'} day${loan.daysRemaining === 1 ? '' : 's'} left`;
    } else {
      badge.className = 'badge secondary';
      badge.textContent = `Returned ${formatDate(loan.returnedAt)}`;
    }
    statusCell.appendChild(badge);
    const actions = document.createElement('div');
    actions.className = 'actions';
    if (allowActions && loan.status === 'borrowed') {
      const returnBtn = document.createElement('button');
      returnBtn.type = 'button';
      returnBtn.className = 'button small danger';
      returnBtn.textContent = 'Return';
      returnBtn.addEventListener('click', () => handleReturnLoan(loan, 'myLoans'));
      const renewBtn = document.createElement('button');
      renewBtn.type = 'button';
      renewBtn.className = 'button small secondary';
      renewBtn.textContent = 'Renew';
      renewBtn.disabled = (loan.renewalsUsed || 0) >= (loan.maxRenewals ?? 1);
      renewBtn.addEventListener('click', () => handleRenewLoan(loan, 'myLoans'));
      actions.appendChild(returnBtn);
      actions.appendChild(renewBtn);
    }
    row.children[5].appendChild(actions);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function renderAccount() {
  viewEl.innerHTML = '';
  const wrapper = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'section-header';
  const title = document.createElement('h2');
  title.textContent = 'Account';
  header.appendChild(title);
  wrapper.appendChild(header);
  const infoCard = document.createElement('div');
  infoCard.className = 'card account-card';
  infoCard.innerHTML = `
    <h3>${state.user.displayName || state.user.username}</h3>
    <dl>
      <div><dt>Username</dt><dd>${state.user.username}</dd></div>
      <div><dt>Email</dt><dd>${state.user.email || 'Not provided'}</dd></div>
      <div><dt>Role</dt><dd>${state.user.role}</dd></div>
    </dl>
  `;
  wrapper.appendChild(infoCard);
  const statsCard = document.createElement('div');
  statsCard.className = 'card';
  const loans = state.loans || [];
  const active = loans.filter((loan) => loan.status === 'borrowed');
  const overdue = active.filter((loan) => loan.daysRemaining < 0);
  statsCard.innerHTML = `
    <h4>Loan summary</h4>
    <ul class="stat-list">
      <li><strong>${active.length}</strong> active loan${active.length === 1 ? '' : 's'}</li>
      <li><strong>${overdue.length}</strong> overdue</li>
      <li><strong>${loans.length}</strong> total borrowed</li>
    </ul>
  `;
  wrapper.appendChild(statsCard);
  viewEl.appendChild(wrapper);
}
async function handleReturnLoan(loan, redirectView) {
  try {
    await api(`/api/loans/${loan._id}/return`, { method: 'POST' });
    showMessage('success', `${loan.cdTitle} returned.`);
    const target = redirectView || (state.user.role === 'admin' ? 'loans' : 'myLoans');
    await loadView(target);
  } catch (error) {
    showMessage('error', error.message);
  }
}

async function handleRenewLoan(loan, redirectView) {
  try {
    await api(`/api/loans/${loan._id}/renew`, { method: 'POST' });
    showMessage('success', `${loan.cdTitle} renewed.`);
    const target = redirectView || (state.user.role === 'admin' ? 'loans' : 'myLoans');
    await loadView(target);
  } catch (error) {
    showMessage('error', error.message);
  }
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

async function bootstrap() {
  try {
    const session = await api('/api/session');
    setUser(session.user);
  } catch (error) {
    setUser(null);
  }
}

bootstrap();
