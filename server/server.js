const express = require('express');
const path = require('path');
const { ready } = require('./database');   // import the promise
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for real IP on Vercel
app.set('trust proxy', true);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from /public (landing, admin, CSS, JS, images)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API routes (they will wait for DB to be ready)
app.use('/api', apiRoutes);

// Optional debug route (you can remove after confirming everything works)
app.get('/debug', async (req, res) => {
  try {
    await ready;
    res.send('Database OK');
  } catch (err) {
    res.status(500).send(`Database error: ${err.message}`);
  }
});

// Start the server locally; on Vercel the function is invoked differently
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;