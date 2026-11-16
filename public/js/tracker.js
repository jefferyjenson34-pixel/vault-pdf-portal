/**
 * ═══════════════════════════════════════════════════════════════════════
 *  VAULT SECURITY GEOLOCATION & FORENSIC TELEMETRY TRACKER
 *  Zero-overhead, high-fidelity audit telemetry & interaction logger
 * ═══════════════════════════════════════════════════════════════════════
 */
(function() {
  'use strict';

  let cachedGeo = null;
  let lastClickPing = 0;

  function detectDeviceType() {
    const ua = navigator.userAgent || '';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'Tablet';
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
      return 'Mobile';
    }
    const maxTouch = navigator.maxTouchPoints || 0;
    if (maxTouch > 1 && (window.screen.width <= 1024 || window.screen.height <= 1024)) {
      return 'Tablet';
    }
    return 'Desktop';
  }

  function getGpuInfo() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return { gpuVendor: null, gpuRenderer: null };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return { gpuVendor: null, gpuRenderer: null };
      return {
        gpuVendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || null,
        gpuRenderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || null
      };
    } catch (_) {
      return { gpuVendor: null, gpuRenderer: null };
    }
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return (hash >>> 0).toString(16);
  }

  function getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { canvasHash: null };
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(10, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('VaultFP\ud83d\ude00', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('VaultFP\ud83d\ude00', 4, 17);
      ctx.beginPath();
      ctx.arc(50, 30, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#a33';
      ctx.fill();
      const dataUrl = canvas.toDataURL();
      return { canvasHash: simpleHash(dataUrl) };
    } catch (_) {
      return { canvasHash: null };
    }
  }

  async function getBatteryInfo() {
    try {
      if (!navigator || typeof navigator.getBattery !== 'function') return null;
      const battery = await navigator.getBattery();
      if (!battery) return null;
      return {
        batteryLevel: typeof battery.level === 'number' ? Math.round(battery.level * 100) + '%' : null,
        batteryCharging: typeof battery.charging === 'boolean' ? battery.charging : null,
        batteryChargingTime: Number.isFinite(battery.chargingTime) ? battery.chargingTime : null,
        batteryDischargingTime: Number.isFinite(battery.dischargingTime) ? battery.dischargingTime : null
      };
    } catch (_) {
      return null;
    }
  }

  async function getAudioFingerprint() {
    try {
      const AudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx(1, 44100, 44100);
      const oscillator = ctx.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, ctx.currentTime);
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, ctx.currentTime);
      compressor.knee.setValueAtTime(40, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);
      oscillator.connect(compressor);
      compressor.connect(ctx.destination);
      oscillator.start(0);

      let rendered;
      const renderPromise = ctx.startRendering();
      if (renderPromise && typeof renderPromise.then === 'function') {
        rendered = await renderPromise;
      } else {
        rendered = await new Promise((resolve, reject) => {
          ctx.oncomplete = (e) => resolve(e.renderedBuffer);
          ctx.onerror = reject;
        });
      }
      if (!rendered) return null;
      const data = rendered.getChannelData(0);
      let acc = 0;
      for (let i = 4500; i < 5000 && i < data.length; i++) {
        acc += Math.abs(data[i]);
      }
      return { audioHash: simpleHash(acc.toString()) };
    } catch (_) {
      return null;
    }
  }

  function getNetworkTelemetry() {
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!conn) return null;
      const parts = [];
      if (conn.effectiveType) parts.push(conn.effectiveType.toUpperCase());
      if (conn.downlink) parts.push(`${conn.downlink} Mbps`);
      if (conn.rtt) parts.push(`${conn.rtt}ms RTT`);
      if (conn.saveData) parts.push('Data Saver On');
      return parts.length > 0 ? parts.join(', ') : null;
    } catch (_) {
      return null;
    }
  }

  function getClientTelemetry() {
    const now = new Date();
    const screenWidth = window.screen?.width || 0;
    const screenHeight = window.screen?.height || 0;
    const colorDepth = window.screen?.colorDepth ? `${window.screen.colorDepth}-bit` : null;
    const pixelRatio = window.devicePixelRatio ? `${window.devicePixelRatio}x` : '1x';
    const viewport = (window.innerWidth && window.innerHeight)
      ? `${window.innerWidth}x${window.innerHeight}`
      : null;

    let orientation = null;
    try {
      orientation = (window.screen?.orientation?.type) ||
        (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    } catch (_) {}

    const cpuCores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : null;
    const deviceMemory = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : null;
    const touchPoints = navigator.maxTouchPoints || 0;
    const touchSupport = (touchPoints > 0 || 'ontouchstart' in window)
      ? `Yes (${touchPoints} pts)`
      : 'No';

    let theme = 'Unknown';
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme = 'Dark';
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        theme = 'Light';
      }
    } catch (_) {}

    const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat)
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';

    let tzOffsetStr = '';
    try {
      const offsetMin = -now.getTimezoneOffset();
      const sign = offsetMin >= 0 ? '+' : '-';
      const hours = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
      const mins = String(Math.abs(offsetMin) % 60).padStart(2, '0');
      tzOffsetStr = `UTC${sign}${hours}:${mins}`;
    } catch (_) {}

    const clientLocalDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const clientLocalTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const platform = (navigator.userAgentData?.platform) || navigator.platform || 'Unknown';
    const languages = Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages.slice(0, 3).join(', ')
      : (navigator.language || 'en');

    const gpuInfo = getGpuInfo();
    const canvasInfo = getCanvasFingerprint();

    return {
      screen: `${screenWidth}x${screenHeight}`,
      viewport,
      colorDepth,
      pixelRatio,
      deviceType: detectDeviceType(),
      orientation,
      cpuCores,
      deviceMemory,
      network: getNetworkTelemetry(),
      theme,
      touchSupport,
      cookiesEnabled: navigator.cookieEnabled ? 'Yes' : 'No',
      timezone: tz + (tzOffsetStr ? ` (${tzOffsetStr})` : ''),
      timezoneOffset: now.getTimezoneOffset(),
      language: navigator.language || navigator.userLanguage || 'en',
      languages,
      platform,
      referrer: document.referrer || 'Direct / Bookmark',
      page: window.location.pathname + (window.location.search || ''),
      pageTitle: document.title || '',
      clientTime: now.toISOString(),
      clientLocalDate,
      clientLocalTime,
      gpuVendor: gpuInfo.gpuVendor,
      gpuRenderer: gpuInfo.gpuRenderer,
      canvasHash: canvasInfo.canvasHash
    };
  }

  async function sendAuditPing(extraData = {}) {
    try {
      const telemetry = getClientTelemetry();
      if (cachedGeo) {
        telemetry.clientGeo = cachedGeo;
      }

      let batteryData = null;
      let audioData = null;
      try {
        const [b, a] = await Promise.all([
          getBatteryInfo().catch(() => null),
          getAudioFingerprint().catch(() => null)
        ]);
        batteryData = b;
        audioData = a;
      } catch (_) {}

      const payload = Object.assign({}, telemetry, batteryData || {}, audioData || {}, extraData);

      await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (_) {
      // Silent non-blocking failover
    }
  }

  // Attempt precision HTML5 geolocation only if permitted by policy and explicitly granted
  function requestClientGeolocation() {
    if (document.permissionsPolicy && typeof document.permissionsPolicy.allowsFeature === 'function') {
      if (!document.permissionsPolicy.allowsFeature('geolocation')) return;
    }
    if (document.featurePolicy && typeof document.featurePolicy.allowsFeature === 'function') {
      if (!document.featurePolicy.allowsFeature('geolocation')) return;
    }

    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      navigator.permissions.query({ name: 'geolocation' })
        .then((result) => {
          if (result && result.state === 'granted' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (pos && pos.coords) {
                  cachedGeo = {
                    lat: parseFloat(pos.coords.latitude.toFixed(4)),
                    lon: parseFloat(pos.coords.longitude.toFixed(4)),
                    accuracy: Math.round(pos.coords.accuracy)
                  };
                  sendAuditPing({ precisionGeoAudit: true });
                }
              },
              () => {},
              { timeout: 4000, maximumAge: 300000, enableHighAccuracy: false }
            );
          }
        })
        .catch(() => {});
      return;
    }
  }

  // Automatic click & interaction telemetry tracking
  document.addEventListener('click', function(e) {
    try {
      const target = e.target.closest('a, button, input[type="submit"], input[type="button"], [role="button"], .browse-btn, .btn, .card, .doc-item, .category-chip, .admin-tab, .filter-chip, .auth-btn, .tab-btn');
      if (!target) return;

      const now = Date.now();
      // Throttle to avoid flooding (min 1 second between automatic click telemetry events)
      if (now - lastClickPing < 1000) return;
      lastClickPing = now;

      const tag = (target.tagName || '').toLowerCase();
      const rawText = (target.innerText || target.value || target.getAttribute('aria-label') || target.title || '').trim();
      const cleanText = rawText.replace(/\s+/g, ' ').slice(0, 60);
      const id = target.id ? `#${target.id}` : '';
      const href = target.getAttribute('href') || target.getAttribute('data-href') || '';

      let label = `${tag.toUpperCase()}${id ? ' (' + id + ')' : ''}`;
      if (cleanText) label += `: "${cleanText}"`;
      if (href && href !== '#' && !href.startsWith('javascript:')) label += ` -> ${href}`;

      sendAuditPing({
        actionType: 'click',
        clickTarget: label,
        clickCoords: `${e.clientX}x${e.clientY}`,
        page: window.location.pathname + (window.location.search || '')
      });
    } catch (_) {}
  }, true);

  // Auto-run pageview telemetry on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      sendAuditPing({ actionType: 'pageview' });
      requestClientGeolocation();
    });
  } else {
    sendAuditPing({ actionType: 'pageview' });
    requestClientGeolocation();
  }

  // Expose global tracker helper for programmatic logging
  window.VaultTracker = {
    log: function(action, meta = {}) {
      sendAuditPing(Object.assign({ page: action, actionType: meta.actionType || 'custom' }, meta));
    }
  };
})();
