const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const morgan = require('morgan');
const mongoose = require('mongoose');
const ejs = require('ejs');
const dotenv = require('dotenv');

const User = require('./models/User');
const CD = require('./models/CD');
const Loan = require('./models/Loan');

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cd-borrowing';

const app = express();
app.engine('ejs', ejs.__express);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(session({ secret: 'cd-borrowing-secret', cookie: { path: '/', httpOnly: true, maxAge: 1000 * 60 * 60 * 24 } }));

app.use((req, res, next) => {
  req.session = req.session || {};
  req.session.flash = req.session.flash || [];
  req.flash = (type, message) => {
    req.session.flash.push({ type, message });
  };
  res.render = (view, data = {}) => {
    const messages = req.session.flash.slice();
    req.session.flash = [];
    const locals = { ...data, currentUser: req.session.user || null, flashMessages: messages };
    app.render(view, locals, (err, content) => {
      if (err) {
        res.status(500).send(err.message);
        return;
      }
      const pageTitle = locals.pageTitle || data.pageTitle || 'Dashboard';
      app.render('layout', { ...locals, pageTitle, body: content }, (layoutErr, layoutHtml) => {
        if (layoutErr) {
          res.status(500).send(layoutErr.message);
          return;
        }
        res.send(layoutHtml);
      });
    });
  };
  res.locals.currentUser = req.session.user || null;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.flash('error', 'Please sign in first.');
    res.redirect('/login');
    return;
  }
  next();
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    const admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      await User.createWithPassword({ username: 'admin', password: 'admin123', role: 'admin' });
      console.log('Seeded default admin user (admin / admin123)');
    }
  })
  .catch((error) => {
    console.error('Failed to initialise data store', error);
  });

app.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('/');
    return;
  }
  res.render('login', { pageTitle: 'Login' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    req.flash('error', 'Username and password are required.');
    res.redirect('/login');
    return;
  }
  const user = await User.verifyCredentials(username, password);
  if (!user) {
    req.flash('error', 'Invalid username or password.');
    res.redirect('/login');
    return;
  }
  req.session.user = { _id: user._id, username: user.username, role: user.role };
  req.flash('success', `Welcome back ${user.username}!`);
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.user = null;
  req.flash('info', 'Signed out successfully.');
  res.redirect('/login');
});

app.get('/', requireAuth, async (req, res) => {
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
  res.render('dashboard', { pageTitle: 'Dashboard', stats, recentCDs });
});

app.get('/cds', requireAuth, async (req, res) => {
  const cds = await CD.find();
  res.render('cds/index', { pageTitle: 'CD Library', cds });
});

app.get('/cds/new', requireAuth, (req, res) => {
  res.render('cds/new', { pageTitle: 'Add CD' });
});

app.post('/cds', requireAuth, async (req, res) => {
  const { title, artist, genre, year, totalCopies } = req.body;
  if (!title || !artist || !genre || !year || !totalCopies) {
    req.flash('error', 'All fields are required.');
    res.redirect('/cds/new');
    return;
  }
  const numericYear = Number(year);
  const total = Number(totalCopies);
  await CD.create({
    title,
    artist,
    genre,
    year: numericYear,
    totalCopies: total,
    availableCopies: total,
  });
  req.flash('success', `${title} added to the library.`);
  res.redirect('/cds');
});

app.get('/cds/:id', requireAuth, async (req, res) => {
  const cd = await CD.findById(req.params.id);
  if (!cd) {
    req.flash('error', 'CD not found.');
    res.redirect('/cds');
    return;
  }
  const loans = await Loan.find({ cdId: cd._id });
  res.render('cds/show', { pageTitle: cd.title, cd, loans: loans.slice(-10).reverse() });
});

app.get('/cds/:id/edit', requireAuth, async (req, res) => {
  const cd = await CD.findById(req.params.id);
  if (!cd) {
    req.flash('error', 'CD not found.');
    res.redirect('/cds');
    return;
  }
  res.render('cds/edit', { pageTitle: `Edit ${cd.title}`, cd });
});

app.put('/cds/:id', requireAuth, async (req, res) => {
  const { title, artist, genre, year, totalCopies, availableCopies } = req.body;
  const updated = await CD.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        title,
        artist,
        genre,
        year: Number(year),
        totalCopies: Number(totalCopies),
        availableCopies: Math.min(Number(totalCopies), Number(availableCopies)),
      },
    },
    { new: true },
  );
  if (!updated) {
    req.flash('error', 'CD not found.');
  } else {
    req.flash('success', 'CD updated successfully.');
  }
  res.redirect(`/cds/${req.params.id}`);
});

app.delete('/cds/:id', requireAuth, async (req, res) => {
  const deleted = await CD.findByIdAndDelete(req.params.id);
  if (deleted) {
    await Loan.deleteMany({ cdId: req.params.id });
    req.flash('success', 'CD deleted.');
  } else {
    req.flash('error', 'CD not found.');
  }
  res.redirect('/cds');
});

app.post('/cds/:id/borrow', requireAuth, async (req, res) => {
  const cd = await CD.findById(req.params.id);
  if (!cd) {
    req.flash('error', 'CD not found.');
    res.redirect('/cds');
    return;
  }
  if ((cd.availableCopies || 0) <= 0) {
    req.flash('error', 'No copies available.');
    res.redirect(`/cds/${cd._id}`);
    return;
  }
  const { borrowerName, borrowerEmail } = req.body;
  if (!borrowerName || !borrowerEmail) {
    req.flash('error', 'Borrower information is required.');
    res.redirect(`/cds/${cd._id}`);
    return;
  }
  cd.availableCopies = (cd.availableCopies || 0) - 1;
  await cd.save();
  await Loan.create({
    borrowerName,
    borrowerEmail,
    cdId: cd._id,
    cdTitle: cd.title,
    status: 'borrowed',
    borrowedAt: new Date(),
  });
  req.flash('success', `${borrowerName} borrowed ${cd.title}.`);
  res.redirect(`/cds/${cd._id}`);
});

app.get('/loans', requireAuth, async (req, res) => {
  const loans = await Loan.find({ status: 'borrowed' });
  res.render('loans/index', { pageTitle: 'Active Loans', loans });
});

app.get('/loans/history', requireAuth, async (req, res) => {
  const loans = await Loan.find();
  res.render('loans/history', { pageTitle: 'Loan History', loans: loans.reverse() });
});

app.put('/loans/:id', requireAuth, async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) {
    req.flash('error', 'Loan not found.');
    res.redirect('/loans');
    return;
  }
  if (req.body.action === 'return' && loan.status !== 'returned') {
    loan.status = 'returned';
    loan.returnedAt = new Date();
    await loan.save();
    const cd = await CD.findById(loan.cdId);
    if (cd) {
      cd.availableCopies = Math.min((cd.availableCopies || 0) + 1, cd.totalCopies || (cd.availableCopies || 0) + 1);
      await cd.save();
    }
    req.flash('success', `${loan.cdTitle} returned.`);
  }
  res.redirect('/loans');
});

app.get('/api/cds', requireAuth, async (req, res) => {
  const cds = await CD.find();
  res.json(cds.map((cd) => cd.toObject()));
});

app.get('/api/cds/:id', requireAuth, async (req, res) => {
  const cd = await CD.findById(req.params.id);
  if (!cd) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(cd.toObject());
});

app.post('/api/cds', requireAuth, async (req, res) => {
  const { title, artist, genre, year, totalCopies } = req.body;
  if (!title || !artist || !genre || !year || !totalCopies) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  const cd = await CD.create({
    title,
    artist,
    genre,
    year: Number(year),
    totalCopies: Number(totalCopies),
    availableCopies: Number(totalCopies),
  });
  res.status(201).json(cd.toObject());
});

app.put('/api/cds/:id', requireAuth, async (req, res) => {
  const updated = await CD.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true },
  );
  if (!updated) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(updated.toObject());
});

app.delete('/api/cds/:id', requireAuth, async (req, res) => {
  const deleted = await CD.findByIdAndDelete(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await Loan.deleteMany({ cdId: req.params.id });
  res.json({ success: true });
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
