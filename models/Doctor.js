const mongoose = require('mongoose');
const DoctorSchema = new mongoose.Schema({
  username: String,
  password: String,
  name: String
});
module.exports = mongoose.model('Doctor', DoctorSchema);
