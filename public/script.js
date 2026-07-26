/**
 * Visitor analytics collection script.
 * - Sets a persistent visitor ID cookie (1 year).
 * - Detects browser, OS, device type, resolution, language, referrer.
 * - Sends data to POST /api/visit.
 */
(function () {
  'use strict';

  // ---------- Helper: get/set cookie ----------
  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
  }

  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
  }

  // ---------- Visitor ID (persist 365 days) ----------
  let visitorId = getCookie('visitor_id');
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : 
                'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                  const r = Math.random() * 16 | 0;
                  const v = c === 'x' ? r : (r & 0x3 | 0x8);
                  return v.toString(16);
                });
    setCookie('visitor_id', visitorId, 365);
  }

  // ---------- Browser / OS / Device detection ----------
  const ua = navigator.userAgent;
  let browserName = "Unknown";
  let browserVersion = "";

  if (ua.indexOf("Firefox") > -1) {
    browserName = "Firefox";
    browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || "";
  } else if (ua.indexOf("Edg") > -1) {
    browserName = "Edge";
    browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || "";
  } else if (ua.indexOf("Chrome") > -1) {
    browserName = "Chrome";
    browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || "";
  } else if (ua.indexOf("Safari") > -1) {
    browserName = "Safari";
    browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || "";
  }

  let os = "Unknown";
  if (ua.indexOf("Windows") > -1) os = "Windows";
  else if (ua.indexOf("Mac") > -1) os = "MacOS";
  else if (ua.indexOf("Linux") > -1) os = "Linux";
  else if (ua.indexOf("Android") > -1) os = "Android";
  else if (ua.indexOf("iOS") > -1 || ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1) os = "iOS";

  // Device type
  const isMobile = /Mobi|Android/i.test(ua);
  const isTablet = /iPad|Tablet|PlayBook/i.test(ua) || (isMobile && window.innerWidth > 768);
  let deviceType = "Desktop";
  if (isTablet) deviceType = "Tablet";
  else if (isMobile) deviceType = "Mobile";

  // Screen resolution
  const screenRes = `${window.screen.width}x${window.screen.height}`;

  // Language
  const language = navigator.language || "Unknown";

  // Referrer
  const referrer = document.referrer || "";

  // ---------- Send analytics ----------
  const payload = {
    visitor_id: visitorId,
    browser_name: browserName,
    browser_version: browserVersion,
    os: os,
    device_type: deviceType,
    screen_resolution: screenRes,
    language: language,
    referrer: referrer,
    user_agent: ua
  };

  fetch('/api/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    console.log('Visit recorded, visitor ID:', data.visitor_id);
  })
  .catch(err => {
    console.error('Analytics recording failed:', err);
  });
})();