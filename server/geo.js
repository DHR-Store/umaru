/**
 * IP geolocation module using the free ip-api.com service (no API key required).
 * Returns country, region, city, timezone.
 * Falls back to 'Unknown' on any error.
 */
const https = require('https');

/**
 * Fetch geolocation data for an IP.
 * @param {string} ip - The IP address to look up.
 * @returns {Promise<Object>} { country, region, city, timezone }
 */
function getGeoFromIP(ip) {
  return new Promise((resolve) => {
    // Skip lookup for local/private IPs
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return resolve({
        country: 'Localhost',
        region: 'Local',
        city: 'Local',
        timezone: 'Local'
      });
    }

    // Use ip-api.com (free, no key required, 45 requests/minute per IP)
    const url = `https://ip-api.com/json/${ip}?fields=country,regionName,city,timezone`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'fail') {
            throw new Error(json.message || 'Lookup failed');
          }
          resolve({
            country: json.country || 'Unknown',
            region: json.regionName || 'Unknown',
            city: json.city || 'Unknown',
            timezone: json.timezone || 'Unknown'
          });
        } catch (e) {
          console.error('Geo lookup error:', e.message);
          resolve({
            country: 'Unknown',
            region: 'Unknown',
            city: 'Unknown',
            timezone: 'Unknown'
          });
        }
      });
    }).on('error', (err) => {
      console.error('Geo request error:', err.message);
      resolve({
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown',
        timezone: 'Unknown'
      });
    });
  });
}

module.exports = { getGeoFromIP };