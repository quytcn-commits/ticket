const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

// Initialize DB (runs schema + seed)
require('./db/connection');

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/events', require('./routes/students'));
app.use('/api/staffs', require('./routes/staffs'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/checkin', require('./routes/checkin'));
app.use('/api/reports', require('./routes/reports'));

// Error handler
app.use(require('./middleware/errorHandler'));

// Serve client in production
const clientDist = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '../client-dist')
  : path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Client not built' });
  }
});

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});
