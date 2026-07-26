/**
 * Main Express server.
 * - Serves static files from the /public folder.
 * - Mounts API routes.
 * - Configures trust proxy for correct IP detection.
 */
const express = require('express');
const path = require('path');
const { initDatabase } = require('./database');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy to get real IP behind reverse proxies (Vercel, Nginx)
app.set('trust proxy', true);

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API routes under /api
app.use('/api', apiRoutes);

// Initialize database and start server
initDatabase();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app; // for Vercel serverless