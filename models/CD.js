const mongoose = require('mongoose');

const cdSchema = new mongoose.Schema({
  title: String,
  artist: String,
  genre: String,
  year: Number,
  totalCopies: { type: Number, default: 1 },
  availableCopies: { type: Number, default: 1 },
  createdAt: { type: Date, default: () => new Date() },
});

const CD = mongoose.model('CD', cdSchema);

CD.prototype.borrowable = function borrowable() {
  return (this.availableCopies || 0) > 0;
};

module.exports = CD;
