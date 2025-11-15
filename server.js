const fs = require('fs');
const path = require('path');
const express = require('./lib/express');
const session = require('./lib/express-session');
const morgan = require('./lib/morgan');
const dotenv = require('./lib/dotenv');

const User = require('./models/User');
const CD = require('./models/CD');
const Loan = require('./models/Loan');

dotenv.config();

const PORT = process.env.PORT || 3000;
const BORROW_TERM_DAYS = 30;
const MAX_RENEWALS = 1;

const app = express();

app.use(morgan());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: 'cd-borrowing-secret',
    cookie: { path: '/', httpOnly: true, maxAge: 1000 * 60 * 60 * 24 },
  }),
);

app.use((req, res, next) => {
  req.session = req.session || {};
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

async function bootstrapData() {
  try {
    await User.ensureDefaultAdmin();
    await CD.ensureSeeded();
    console.log('Seed data ready. Admin login: admin / admin');
  } catch (error) {
    console.error('Unable to seed initial data', error);
  }
}

bootstrapData();

app.post('/api/login', async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }
  const user = await User.verifyCredentials(username, password);
  if (!user) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }
  req.session.user = {
    _id: user._id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    email: user.email,
  };
  res.json({ user: req.session.user });
});

app.post('/api/register', async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const confirm = req.body.confirm || '';
  const displayName = (req.body.displayName || '').trim();
  const email = (req.body.email || '').trim();
  if (!username || !password || !displayName || !email) {
    res.status(400).json({ error: 'Username, password, name, and email are required.' });
    return;
  }
  if (username.toLowerCase() === 'admin') {
    res.status(400).json({ error: 'This username is reserved.' });
    return;
  }
  if (password !== confirm) {
    res.status(400).json({ error: 'Passwords do not match.' });
    return;
  }
  if (username.length < 3 || password.length < 6) {
    res.status(400).json({ error: 'Use at least 3 characters for username and 6 for password.' });
    return;
  }
  if (await User.usernameExists(username)) {
    res.status(409).json({ error: 'Username already exists.' });
    return;
  }
  const newUser = await User.createWithPassword({
    username,
    password,
    role: 'member',
    displayName,
    email,
  });
  const sessionUser = {
    _id: newUser._id,
    username: newUser.username,
    role: newUser.role,
    displayName: newUser.displayName,
    email: newUser.email,
  };
  req.session.user = sessionUser;
  res.status(201).json({ user: sessionUser });
});

app.post('/api/logout', (req, res) => {
  req.session.user = null;
  res.json({ success: true });
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ user: req.session.user });
});

app.get('/api/dashboard', requireAuth, requireRole('admin'), async (req, res) => {
  const [totalCDs, cdList, activeLoans, allLoans] = await Promise.all([
    CD.countDocuments(),
    CD.find(),
    Loan.find({ status: 'borrowed' }),
    Loan.find(),
  ]);
  const availableCopies = cdList.reduce((sum, cd) => sum + Number(cd.availableCopies || 0), 0);
  const stats = {
    totalCDs,
    availableCopies,
    activeLoans: activeLoans.length,
    totalLoans: allLoans.length,
  };
  const recentCDs = cdList.slice(-5).reverse();
  res.json({ stats, recentCDs });
});

function mapLoanMeta(loan) {
  if (!loan) return null;
  const now = new Date();
  const due = loan.dueAt ? new Date(loan.dueAt) : null;
  let daysRemaining = null;
  if (due) {
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = diff;
  }
  const borrowedAt = loan.borrowedAt ? new Date(loan.borrowedAt) : null;
  const daysBorrowed = borrowedAt
    ? Math.ceil((now.getTime() - borrowedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  return {
    _id: loan._id,
    borrowerName: loan.borrowerName,
    borrowerEmail: loan.borrowerEmail,
    userId: loan.userId,
    borrowedAt: loan.borrowedAt,
    dueAt: loan.dueAt,
    returnedAt: loan.returnedAt,
    status: loan.status,
    renewalsUsed: loan.renewalsUsed,
    maxRenewals: loan.maxRenewals,
    lastRenewedAt: loan.lastRenewedAt,
    daysRemaining,
    daysBorrowed,
    isOverdue: typeof daysRemaining === 'number' && daysRemaining < 0 && loan.status === 'borrowed',
  };
}

async function buildLibraryOverview() {
  const [cds, loans] = await Promise.all([CD.find(), Loan.find()]);
  const activeLoans = loans.filter((loan) => loan.status === 'borrowed');
  return cds.map((cd) => {
    const entries = activeLoans
      .filter((loan) => loan.cdId === cd._id)
      .map((loan) => mapLoanMeta(loan));
    return {
      ...cd,
      activeLoans: entries,
    };
  });
}

app.get('/api/library', requireAuth, async (req, res) => {
  const library = await buildLibraryOverview();
  res.json(library);
});

app.get('/api/cds', requireAuth, async (req, res) => {
  const cds = await CD.find();
  res.json(cds);
});

app.get('/api/cds/:id', requireAuth, async (req, res) => {
  const cd = await CD.findById(req.params.id);
  if (!cd) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(cd);
});

app.post('/api/cds', requireAuth, requireRole('admin'), async (req, res) => {
  const { title, artist, genre, year, totalCopies } = req.body;
  if (!title || !artist || !genre || !year || !totalCopies) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }
  const numericYear = Number(year);
  const total = Number(totalCopies);
  if (!Number.isFinite(numericYear) || !Number.isFinite(total)) {
    res.status(400).json({ error: 'Year and total copies must be numbers.' });
    return;
  }
  const cd = await CD.create({
    title,
    artist,
    genre,
    year: numericYear,
    totalCopies: total,
    availableCopies: total,
  });
  res.status(201).json(cd);
});

app.put('/api/cds/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const payload = { ...req.body };
  if (payload.year !== undefined) payload.year = Number(payload.year);
  if (payload.totalCopies !== undefined) payload.totalCopies = Number(payload.totalCopies);
  if (payload.availableCopies !== undefined) payload.availableCopies = Number(payload.availableCopies);
  if (
    Number.isFinite(payload.totalCopies) &&
    Number.isFinite(payload.availableCopies) &&
    payload.availableCopies > payload.totalCopies
  ) {
    payload.availableCopies = payload.totalCopies;
  }
  const updated = await CD.findByIdAndUpdate(req.params.id, payload);
  if (!updated) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(updated);
});

app.delete('/api/cds/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const deleted = await CD.findByIdAndDelete(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await Loan.deleteMany({ cdId: req.params.id });
  res.json({ success: true });
});

app.post('/api/cds/:id/borrow', requireAuth, async (req, res) => {
  const cd = await CD.findById(req.params.id);
  if (!cd) {
    res.status(404).json({ error: 'CD not found.' });
    return;
  }
  if ((cd.availableCopies || 0) <= 0) {
    res.status(400).json({ error: 'No copies available.' });
    return;
  }
  let borrowerName = (req.body.borrowerName || '').trim();
  let borrowerEmail = (req.body.borrowerEmail || '').trim();
  let userId = null;
  if (req.session.user.role === 'member') {
    borrowerName = req.session.user.displayName || req.session.user.username;
    borrowerEmail = req.session.user.email || `${req.session.user.username}@local`;
    userId = req.session.user._id;
  }
  if (!borrowerName || !borrowerEmail) {
    res.status(400).json({ error: 'Borrower information is required.' });
    return;
  }
  await CD.adjustAvailableCopies(cd._id, -1);
  const loan = await Loan.create({
    borrowerName,
    borrowerEmail,
    cdId: cd._id,
    cdTitle: cd.title,
    status: 'borrowed',
    borrowedAt: new Date().toISOString(),
    termDays: BORROW_TERM_DAYS,
    maxRenewals: MAX_RENEWALS,
    userId,
  });
  const updatedCd = await CD.findById(cd._id);
  res.json({ loan, cd: updatedCd });
});

app.get('/api/loans', requireAuth, async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  if (req.session.user.role !== 'admin') {
    filter.userId = req.session.user._id;
  }
  const loans = await Loan.find(filter);
  const sorted = loans
    .sort((a, b) => new Date(b.borrowedAt || 0) - new Date(a.borrowedAt || 0))
    .map((loan) => mapLoanMeta(loan));
  res.json(sorted);
});

app.post('/api/loans/:id/return', requireAuth, async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) {
    res.status(404).json({ error: 'Loan not found.' });
    return;
  }
  if (req.session.user.role !== 'admin' && loan.userId !== req.session.user._id) {
    res.status(403).json({ error: 'You can only return your own loans.' });
    return;
  }
  if (loan.status !== 'returned') {
    await Loan.findByIdAndUpdate(loan._id, {
      status: 'returned',
      returnedAt: new Date().toISOString(),
    });
    await CD.adjustAvailableCopies(loan.cdId, 1);
  }
  const updatedLoan = await Loan.findById(loan._id);
  res.json({ loan: mapLoanMeta(updatedLoan) });
});

app.post('/api/loans/:id/renew', requireAuth, async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) {
    res.status(404).json({ error: 'Loan not found.' });
    return;
  }
  if (loan.status !== 'borrowed') {
    res.status(400).json({ error: 'Only active loans can be renewed.' });
    return;
  }
  if (req.session.user.role !== 'admin' && loan.userId !== req.session.user._id) {
    res.status(403).json({ error: 'You can only renew your own loans.' });
    return;
  }
  if (loan.renewalsUsed >= (loan.maxRenewals ?? MAX_RENEWALS)) {
    res.status(400).json({ error: 'Renewal limit reached.' });
    return;
  }
  const nextDueAt = Loan.calculateDueDate(loan.dueAt || loan.borrowedAt, BORROW_TERM_DAYS);
  const updated = await Loan.findByIdAndUpdate(loan._id, {
    dueAt: nextDueAt,
    renewalsUsed: (loan.renewalsUsed || 0) + 1,
    lastRenewedAt: new Date().toISOString(),
  });
  res.json({ loan: mapLoanMeta(updated) });
});

const indexFile = path.join(__dirname, 'public', 'index.html');

function sendIndex(res) {
  fs.readFile(indexFile, (err, content) => {
    if (err) {
      res.status(500).send('Unable to load page');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(content);
  });
}

app.get('/', (req, res) => {
  sendIndex(res);
});

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    if (req.path === '/' || !req.path.includes('.')) {
      sendIndex(res);
      return;
    }
  }
  next();
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
