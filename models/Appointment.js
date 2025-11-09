const mongoose = require('mongoose');
const AppointmentSchema = new mongoose.Schema({
  patientName: String,
  email: String,
  department: String,
  date: String,
  time: String,
  prescription: String,
  status: { type: String, default: 'Pending' }
});
module.exports = mongoose.model('Appointment', AppointmentSchema);
