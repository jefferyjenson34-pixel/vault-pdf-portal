/**
 * ═══════════════════════════════════════════════════════════════════════
 *  VAULT SECURITY GEOLOCATION & FORENSIC TELEMETRY TRACKER
 *  Zero-overhead, privacy-conscious audit telemetry logger
 * ═══════════════════════════════════════════════════════════════════════
 */
(function() {
  'use strict';

  let cachedGeo = null;

  function getClientTelemetry() {
    return {
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      timezone: (typeof Intl !== 'undefined' && Intl.DateTimeFormat)
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC',
      language: navigator.language || navigator.userLanguage || 'en',
      platform: navigator.platform || 'Unknown',
      referrer: document.referrer || null,
      page: window.location.pathname + (window.location.search || '')
    };
  }

  async function sendAuditPing(extraData = {}) {
    try {
      const telemetry = getClientTelemetry();
      if (cachedGeo) {
        telemetry.clientGeo = cachedGeo;
      }

      const payload = Object.assign({}, telemetry, extraData);

      await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (_) {
      // Silent non-blocking failover
    }
  }

  // Attempt precision HTML5 geolocation if permission is granted
  function requestClientGeolocation() {
    if (navigator.geolocation && window.isSecureContext) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos && pos.coords) {
            cachedGeo = {
              lat: parseFloat(pos.coords.latitude.toFixed(4)),
              lon: parseFloat(pos.coords.longitude.toFixed(4)),
              accuracy: Math.round(pos.coords.accuracy)
            };
            // Send updated telemetry with precise coordinates
            sendAuditPing({ precisionGeoAudit: true });
          }
        },
        () => {
          // Denied or timeout - fallback to IP-based GeoIP
        },
        { timeout: 4000, maximumAge: 300000, enableHighAccuracy: false }
      );
    }
  }

  // Auto-run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      sendAuditPing();
      requestClientGeolocation();
    });
  } else {
    sendAuditPing();
    requestClientGeolocation();
  }

  // Expose global tracker helper
  window.VaultTracker = {
    log: function(action, meta = {}) {
      sendAuditPing(Object.assign({ page: action }, meta));
    }
  };
})();
