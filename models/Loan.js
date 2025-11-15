const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  borrowerName: String,
  borrowerEmail: String,
  cdId: String,
  cdTitle: String,
  status: { type: String, default: 'borrowed' },
  borrowedAt: { type: Date, default: () => new Date() },
  returnedAt: { type: Date, default: null },
});

const Loan = mongoose.model('Loan', loanSchema);

Loan.prototype.markReturned = function markReturned() {
  this.status = 'returned';
  this.returnedAt = new Date();
  return this.save();
};

module.exports = Loan;
