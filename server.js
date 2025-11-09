const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const Doctor = require('./models/Doctor');
const Appointment = require('./models/Appointment');
let appointments = [];
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
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
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
// make sure you have this

app.get('/booking', async (req, res) => {
    try {
        // Fetch all doctors from DB
        const doctors = await Doctor.find(); // you can filter by department if needed

        // Render booking.ejs and send doctors array
        res.render('booking', { doctors });
    } catch (err) {
        console.error('❌ Error loading booking page:', err);
        res.send('<h3>Failed to load booking page. Try again later.</h3>');
    }
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

    res.render('doctor-dashboard', { doctor, appointments });
  } catch (err) {
    console.error('Error loading doctor dashboard:', err);
    res.status(500).send('Error loading dashboard');
  }
});
app.post('/doctor-dashboard', async (req, res) => {
  const { username, password } = req.body;
  try {
    const doctor = await Doctor.findOne({ username: username.trim(), password: password.trim() });
    if (!doctor) {
      return res.send('<h3>Invalid credentials. <a href="/doctor-login">Try again</a></h3>');
    }

    // ✅ Store doctor info in session
    req.session.doctor = doctor;

    // ✅ Load appointments for that doctor’s department
    const appointments = await Appointment.find({ department: doctor.department });

    // ✅ Pass both doctor and appointments to EJS
    res.render('doctor-dashboard', { doctor, appointments });
  } catch (error) {
    console.error('Error logging in doctor:', error);
    res.status(500).send('<h3>Server error. Please try again later.</h3>');
  }
});



// ✅ Update Prescription (and mark as Completed)
app.post('/update-prescription', requireRole('doctor'), async (req, res) => {
    const { appointmentId, prescription } = req.body;

    try {
        // Find appointment by ID
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return res.send('<h3>Appointment not found.</h3>');

        // Update prescription
        appointment.prescription = prescription;
        appointment.status = 'Completed';
        await appointment.save();

        console.log(`Prescription updated for patient: ${appointment.name} (${appointment.email})`);
        res.redirect('/doctor-dashboard');
    } catch (err) {
        console.error(err);
        res.send('<h3>Error updating prescription.</h3>');
    }
});


app.get('/receptionist-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'receptionist-login.html'));
});

app.post('/receptionist-login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'receptionistUser' && password === 'pass123') {
        req.session.user = { role: 'receptionist' };
        req.session.save(err => {
            if (err) console.error('Failed to save session:', err);
            res.redirect('/receptionist-dashboard');
        });
    } else {
        res.send('<h3>Invalid credentials. <a href="/receptionist-login">Try again</a></h3>');
    }
});

// Middleware to check role
function requireRole(role) {
    return (req, res, next) => {
        if (req.session.user?.role === role) return next();
        res.redirect(`/${role}-login`);
    };
}

// Receptionist dashboard & status update
app.get('/receptionist-dashboard', requireRole('receptionist'), (req, res) => {
    res.render('receptionist-dashboard', { appointments });
});

app.post('/update-status', requireRole('receptionist'), (req, res) => {
    const { index, status } = req.body;
    if (appointments[index]) {
        appointments[index].status = status;
    }
    res.redirect('/receptionist-dashboard');
});

app.post('/receptionist-logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/receptionist-login');
    });
});

// ------------------ PATIENT ROUTES ------------------ //
// Patient login page
app.get('/patient-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'patient-login.html'));
});

// Patient dashboard showing their appointments
app.post('/patient-dashboard', async (req, res) => {
    const { email } = req.body;

    try {
        // Fetch the latest appointment for THIS email only
        const latestAppointment = await Appointment.findOne({ email }).sort({ _id: -1 });

        if (latestAppointment) {
            // Render dashboard showing prescription (if doctor has updated it)
            res.render('patient-dashboard', { appointment: latestAppointment });
        } else {
            res.send(`<h3>No appointments found for ${email}. <a href="/patient-login">Try again</a></h3>`);
        }
    } catch (err) {
        console.error(err);
        res.send('<h3>Something went wrong. Try again later.</h3>');
    }
});



app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

function requireLogin(req, res, next) {
    if (req.session.isAdmin) return next();
    res.redirect('/admin-login');
}

app.get('/admin', requireLogin, async (req, res) => {
    try {
        const doctors = await Doctor.find();
        res.render('admin-panel', { doctors });
    } catch (err) {
        console.error('❌ Error fetching doctors:', err);
        res.send('<h3>Failed to load admin panel.</h3>');
    }
});

app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    res.send('<h3>Invalid credentials. <a href="/admin-login">Try again</a></h3>');
});

app.post('/admin-logout', requireLogin, (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/admin-login');
    });
});

// Add / Remove doctors
app.post('/add-doctor', requireLogin, async (req, res) => {
    console.log('Form data:', req.body); 
    const { username, name, password, department } = req.body;

    try {
        // Check if doctor already exists
        const existing = await Doctor.findOne({ username });
        if (existing) {
            return res.send('<h3>⚠️ Doctor with this username already exists!</h3><a href="/admin">Back</a>');
        }

        const newDoctor = new Doctor({ username, name, password, department });
        await newDoctor.save();

        console.log('✅ Doctor added:', newDoctor.username, '-', newDoctor.department);
        res.redirect('/admin');
    } catch (err) {
        console.error('❌ Error adding doctor:', err);
        res.send('<h3>Failed to add doctor.</h3>');
    }
});


app.post('/remove-doctor', requireLogin, async (req, res) => {
    const { id } = req.body;
    try {
        await Doctor.findByIdAndDelete(id);
        console.log('🗑️ Doctor removed:', id);
        res.redirect('/admin');
    } catch (err) {
        console.error('❌ Error removing doctor:', err);
        res.send('<h3>Failed to remove doctor.</h3>');
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
