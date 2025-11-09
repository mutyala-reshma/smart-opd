const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  department: { type: String, required: true } // ✅ new field
});

module.exports = mongoose.model('Doctor', doctorSchema);
