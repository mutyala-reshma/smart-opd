const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const Doctor = require('./models/Doctor');
const Appointment = require('./models/Appointment');

dotenv.config();

const app = express();
const PORT = 3000;

// ✅ Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'smartopd_secret_key',
  resave: false,
  saveUninitialized: true
}));

// ✅ View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  family: 4,
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Landing Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// ✅ Appointment Form Submission
app.post('/submit-appointment', async (req, res) => {
  try {
    console.log("Form Data:", req.body);

    const appointment = new Appointment({
      ...req.body,
      patientName: req.body.name,
      prescription: '',
      status: 'Pending'
    });

    await appointment.save();
    res.redirect('/booking-success');
  } catch (err) {
    console.error(err);
    res.send('<h3>Failed to book appointment. Please try again.</h3>');
  }
});

// ✅ Booking Success Page
app.get('/booking-success', (req, res) => {
  res.send('<h3>Appointment booked successfully! You can go back now.</h3>');
});

// ✅ Doctor Login (Simple Example)
app.get('/doctor-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor-login.html'));
});

app.post('/doctor-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const doctor = await Doctor.findOne({ email, password });

    if (!doctor) {
      return res.send('<h3>Invalid credentials. Please try again.</h3>');
    }

    req.session.doctor = doctor;
    res.redirect('/doctor-dashboard');
  } catch (err) {
    console.error(err);
    res.send('Error during login.');
  }
});

// ✅ Doctor Dashboard
app.get('/doctor-dashboard', async (req, res) => {
  try {
    if (!req.session.doctor) {
      return res.redirect('/doctor-login');
    }

    const doctor = req.session.doctor;
    const appointments = await Appointment.find({ department: doctor.department });

    res.render('doctorDashboard', { doctor, appointments });
  } catch (err) {
    console.error('Error loading doctor dashboard:', err);
    res.status(500).send('Error loading dashboard');
  }
});

// ✅ Update Prescription (and mark as Completed)
app.post('/update-prescription/:id', async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { prescription } = req.body;

    await Appointment.findByIdAndUpdate(appointmentId, {
      prescription,
      status: 'Completed'
    });

    console.log(`✅ Prescription updated for appointment ${appointmentId}`);

    res.redirect('/doctor-dashboard');
  } catch (err) {
    console.error('❌ Error updating prescription:', err);
    res.status(500).send('Failed to update prescription');
  }
});

// ✅ Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
