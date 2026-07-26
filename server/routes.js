const express = require('express');
const router = express.Router();
const {
  ready, insertVisitor, getVisitors, getStats, deleteVisitor,
  getAllVisitorsForExport, getVisitorCount
} = require('./database');
const { getGeoFromIP } = require('./geo');
const { v4: uuidv4 } = require('uuid');

router.use(async (req, res, next) => {
  try {
    await ready;
    next();
  } catch (err) {
    console.error('Database not ready:', err);
    res.status(500).json({ error: 'Database initialisation failed' });
  }
});

router.post('/visit', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress;
    // Use client-provided geo if available
    let geo;
    if (req.body.country_override) {
      geo = {
        country: req.body.country_override || 'Unknown',
        region: req.body.region_override || 'Unknown',
        city: req.body.city_override || 'Unknown',
        timezone: req.body.timezone_override || 'Unknown'
      };
    } else {
      geo = await getGeoFromIP(ip);
    }

    let visitorId = (req.body.visitor_id && String(req.body.visitor_id).trim()) || uuidv4();
    const previousCount = getVisitorCount(visitorId);
    const isReturning = previousCount > 0 ? 1 : 0;
    const visitNumber = previousCount + 1;

    const visitData = {
      visitor_id: visitorId,
      timestamp: new Date().toISOString(),
      ip: ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      timezone: geo.timezone,
      browser_name: req.body.browser_name || 'Unknown',
      browser_version: req.body.browser_version || '',
      os: req.body.os || 'Unknown',
      device_type: req.body.device_type || 'Unknown',
      screen_resolution: req.body.screen_resolution || 'Unknown',
      language: req.body.language || 'Unknown',
      referrer: req.body.referrer || '',
      user_agent: req.body.user_agent || '',
      is_returning: isReturning,
      visit_number: visitNumber
    };

    const id = insertVisitor(visitData);
    res.json({ success: true, id, visitor_id: visitorId });
  } catch (err) {
    console.error('Error recording visit:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/visitors', (req, res) => {
  try {
    const { page = 1, limit = 20, search, country, city, start_date, end_date } = req.query;
    const result = getVisitors({
      page: parseInt(page), limit: parseInt(limit), search, country, city,
      startDate: start_date, endDate: end_date
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stats', (req, res) => {
  try {
    res.json(getStats());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/visitor/:id', (req, res) => {
  try {
    deleteVisitor(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/export', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const data = getAllVisitorsForExport();
    if (format === 'csv') {
      const headers = Object.keys(data[0] || {});
      let csv = headers.join(',') + '\n';
      data.forEach(row => {
        csv += headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(',') + '\n';
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=visitors.csv');
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;