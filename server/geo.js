/**
 * IP geolocation module using free ip-api.com service.
 * Returns country, region, city, timezone from IP address.
 * Falls back to 'Unknown' if lookup fails.
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

    const url = `https://ipapi.co/${ip}/json/`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) throw new Error(json.reason);
          resolve({
            country: json.country_name || 'Unknown',
            region: json.region || 'Unknown',
            city: json.city || 'Unknown',
            timezone: json.timezone || 'Unknown'
          });
        } catch (e) {
          console.error('Geo lookup failed:', e.message);
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