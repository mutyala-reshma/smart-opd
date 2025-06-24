const express = require('express');
require('dotenv').config();
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;
const Doctor = require('./models/Doctor');
const Appointment = require('./models/Appointment');


let appointments = []; 
// Serve static files
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('views', path.join(__dirname, 'views'));


let doctors = [
  { username: 'drjohn', password: '1234', name: 'Dr. John' },
  { username: 'drsmith', password: '5678', name: 'Dr. Smith' }
];

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});app.get('/booking', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'booking.html'));
});
// Serve doctor login page
app.get('/doctor-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'doctor-login.html'));
});

// Process login form
app.post('/doctor-dashboard', async (req, res) => {
  const { username, password } = req.body;
  try {
    const doctor = await Doctor.findOne({ username, password });
    const appointments = await Appointment.find();

    if (doctor) {
      res.render('doctor-dashboard', { appointments });
    } else {
      res.send('<h3>Invalid credentials. <a href="/doctor-login">Try again</a></h3>');
    }
  } catch (err) {
    console.error(err);
    res.send('<h3>Server error. Please try again later.</h3>');
  }
});

// temporary storage

app.post('/submit-appointment', async (req, res) => {
  try {
    console.log("Form Data:", req.body);
    const appointment = new Appointment({
      ...req.body,
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


app.post('/update-prescription', (req, res) => {
  const { index, prescription } = req.body;

  if (appointments[index]) {
    appointments[index].prescription = prescription;
  }

  res.redirect('/doctor-login'); // simulate login again to see updated data
});
const session = require('express-session');

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'a_super_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // change to true if using HTTPS
}));
app.get('/receptionist-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'receptionist-login.html'));
});
app.post('/receptionist-login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'receptionistUser' && password === 'pass123') {
    req.session.user = { role: 'receptionist' };
    req.session.save(err => {
      if (err) console.error('Failed to save session:', err);
      return res.redirect('/receptionist-dashboard');
    });
  } else {
    res.send('<h3>Invalid credentials. <a href="/receptionist-login">Try again</a></h3>');
  }
});
function requireRole(role) {
  return (req, res, next) => {
    if (req.session.user?.role === role) return next();
    res.redirect(`/${role}-login`);
  };
}

// protect receptionist dashboard and status updates
app.get(
  '/receptionist-dashboard',
  requireRole('receptionist'),
  (req, res) => {
    res.render('receptionist-dashboard', { appointments });
  }
);

app.post(
  '/update-status',
  requireRole('receptionist'),
  (req, res) => {
    const { index, status } = req.body;
    if (appointments[index]) {
      appointments[index].status = status;
    }
    res.redirect('/receptionist-dashboard');
  }
);
app.post('/receptionist-logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect('/receptionist-login');
  });
});


app.get('/patient-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'patient-login.html'));
});

app.post('/patient-dashboard', (req, res) => {
  const { email } = req.body;
  const latestAppointment = [...appointments].reverse().find(app => app.email === email);

  if (latestAppointment) {
    res.render('patient-dashboard', { appointment: latestAppointment });
  } else {
    res.send(`<h3>No appointments found for ${email}. <a href="/patient-login">Try again</a></h3>`);
  }
});

app.post('/add-doctor', (req, res) => {
  const { username, password, name } = req.body;
  doctors.push({ username, password, name });
  res.redirect('/admin');
});

app.post('/remove-doctor', (req, res) => {
  const { index } = req.body;
  doctors.splice(index, 1);
  res.redirect('/admin');
});
const nodemailer = require('nodemailer');

// Call this when needed — e.g., doctor marks unavailable
app.post('/notify-unavailable', (req, res) => {
  const { doctorName, email } = req.body;
  sendDoctorUnavailableMail(email, doctorName);
  res.send(`<h3>Notification sent to ${email} that ${doctorName} is unavailable. <a href="/">Home</a></h3>`);
});
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function sendDoctorUnavailableMail(email, doctorName) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Doctor Unavailable',
    text: `Dear Patient, the doctor ${doctorName} is currently unavailable. Please reschedule your appointment.`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.error(error);
    else console.log('Email sent: ' + info.response);
  });
}

// ✅ Move this to the end
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.use(session({
  secret: process.env.SESSION_SECRET || 'aSuperSecretKey',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }  // set secure: true if using HTTPS
}));

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

function requireLogin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect('/admin-login');
}
// Use requireLogin to protect
app.get('/admin', requireLogin, (req, res) => {
  res.render('admin-panel', { doctors });
});

app.post('/admin-logout', requireLogin, (req, res) => {
  req.session.destroy(err => {
    if (err) console.error(err);
    res.redirect('/admin-login');
  });
});


app.post('/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.send('<h3>Invalid credentials. <a href="/admin-login">Try again</a></h3>');
});
app.get('/booking-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'booking-success.html'));
});
