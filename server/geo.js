/**
 * IP geolocation module using ip-api.com (free, no key).
 * Returns country, region, city, timezone.
 * Falls back to 'Unknown' on any error.
 */
const https = require('https');

function getGeoFromIP(ip) {
  return new Promise((resolve) => {
    // Local/private IPs
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return resolve({
        country: 'Localhost',
        region: 'Local',
        city: 'Local',
        timezone: 'Local'
      });
    }

    const url = `https://ip-api.com/json/${ip}?fields=country,regionName,city,timezone`;

    https.get(url, { headers: { 'User-Agent': 'GeoVisitor/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`Geo response for ${ip}:`, JSON.stringify(json));
          if (json.status === 'fail') {
            console.error('ip-api.com failed:', json.message);
            return resolve({ country: 'Unknown', region: 'Unknown', city: 'Unknown', timezone: 'Unknown' });
          }
          resolve({
            country: json.country || 'Unknown',
            region: json.regionName || 'Unknown',
            city: json.city || 'Unknown',
            timezone: json.timezone || 'Unknown'
          });
        } catch (e) {
          console.error('Geo parse error:', e.message, 'Data:', data);
          resolve({ country: 'Unknown', region: 'Unknown', city: 'Unknown', timezone: 'Unknown' });
        }
      });
    }).on('error', (err) => {
      console.error('Geo request error:', err.message);
      resolve({ country: 'Unknown', region: 'Unknown', city: 'Unknown', timezone: 'Unknown' });
    });
  });
}

module.exports = { getGeoFromIP };