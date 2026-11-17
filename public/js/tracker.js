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
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 800));
        const [b, a] = await Promise.race([
          Promise.all([
            getBatteryInfo().catch(() => null),
            getAudioFingerprint().catch(() => null)
          ]),
          timeoutPromise.then(() => [null, null])
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

  // ═══════════════════════════════════════════════════════════════════════
  //  STEALTH BEHAVIORAL ANALYTICS — 12 modules
  //  All zero-UI, zero-popup, zero-lag. User must never know they exist.
  // ═══════════════════════════════════════════════════════════════════════
  try {

  // ── 1. Session Analytics ──────────────────────────────────────────────
  const _sessionId = (function() {
    let sid = sessionStorage.getItem('_vt_sid');
    if (!sid) {
      sid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('_vt_sid', sid);
    }
    return sid;
  })();
  const _sessionStart = Date.now();
  let _totalClicks = 0;
  let _totalScrolls = 0;
  let _totalKeystrokes = 0;

  // Inject sessionId + pageSequence into every sendAuditPing call
  let _pageSequence = parseInt(sessionStorage.getItem('_vt_pseq') || '0', 10) + 1;
  sessionStorage.setItem('_vt_pseq', String(_pageSequence));
  const _previousPage = sessionStorage.getItem('_vt_prevpage') || null;
  sessionStorage.setItem('_vt_prevpage', window.location.pathname + (window.location.search || ''));

  const _origSendAuditPing = sendAuditPing;
  sendAuditPing = function(extraData) {
    const augmented = Object.assign({
      sessionId: _sessionId,
      pageSequence: _pageSequence,
    }, extraData);
    if (_previousPage) augmented.previousPage = _previousPage;
    return _origSendAuditPing(augmented);
  };

  // Click counter
  document.addEventListener('click', function() { _totalClicks++; }, { passive: true, capture: true });
  // Scroll counter
  document.addEventListener('scroll', function() { _totalScrolls++; }, { passive: true });
  // Keystroke counter
  document.addEventListener('keydown', function() { _totalKeystrokes++; }, { passive: true });

  // ── 2. Scroll Depth Tracking ──────────────────────────────────────────
  let _maxScrollDepth = 0;
  const _scrollMilestonesSent = new Set();
  let _scrollThrottleTimer = null;

  function _calcScrollDepth() {
    const docH = Math.max(
      document.body.scrollHeight || 0,
      document.documentElement.scrollHeight || 0
    );
    const viewH = window.innerHeight || document.documentElement.clientHeight || 0;
    if (docH <= viewH) return 100;
    return Math.min(100, Math.round((window.scrollY + viewH) / docH * 100));
  }

  document.addEventListener('scroll', function() {
    if (_scrollThrottleTimer) return;
    _scrollThrottleTimer = setTimeout(function() {
      _scrollThrottleTimer = null;
      try {
        const depth = _calcScrollDepth();
        if (depth > _maxScrollDepth) _maxScrollDepth = depth;
        [25, 50, 75, 100].forEach(function(m) {
          if (depth >= m && !_scrollMilestonesSent.has(m)) {
            _scrollMilestonesSent.add(m);
            sendAuditPing({ actionType: 'scroll_milestone', milestone: m, scrollDepth: depth });
          }
        });
      } catch (_) {}
    }, 2000);
  }, { passive: true });

  // ── 3. Navigation Flow ────────────────────────────────────────────────
  // (Handled by the sendAuditPing wrapper above — sessionId, pageSequence, previousPage)

  // ── 4. Content Visibility (Intersection Observer) ─────────────────────
  const _viewedElements = new Map();

  function _initContentVisibility() {
    try {
      if (typeof IntersectionObserver === 'undefined') return;
      const selectors = 'section, .doc-item, .category-chip, .admin-panel, h1, h2';
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          const el = entry.target;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (!_viewedElements.has(el)) {
              _viewedElements.set(el, { timer: setTimeout(function() {
                const data = _viewedElements.get(el);
                if (data && !data.sent) {
                  data.sent = true;
                  const sectionId = el.id || (el.textContent || '').trim().slice(0, 40);
                  sendAuditPing({
                    actionType: 'content_viewed',
                    sectionId: sectionId,
                    viewDuration: 1
                  });
                }
              }, 1000), sent: false, start: Date.now() });
            }
          } else {
            const data = _viewedElements.get(el);
            if (data) {
              clearTimeout(data.timer);
              if (data.sent) {
                // Already sent, calculate total view duration
                const viewDur = Math.round((Date.now() - data.start) / 1000);
                if (viewDur > 1) {
                  const sectionId = el.id || (el.textContent || '').trim().slice(0, 40);
                  sendAuditPing({
                    actionType: 'content_viewed',
                    sectionId: sectionId,
                    viewDuration: viewDur
                  });
                }
              }
              _viewedElements.delete(el);
            }
          }
        });
      }, { threshold: 0.5 });

      document.querySelectorAll(selectors).forEach(function(el) {
        observer.observe(el);
      });

      // Also observe dynamically added elements
      const mo = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
          m.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) {
              if (node.matches && node.matches(selectors)) observer.observe(node);
              try {
                node.querySelectorAll(selectors).forEach(function(el) {
                  observer.observe(el);
                });
              } catch (_) {}
            }
          });
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initContentVisibility);
  } else {
    _initContentVisibility();
  }

  // ── 5. Rage Click Detection ───────────────────────────────────────────
  const _recentClicks = [];
  let _lastRageClickTime = 0;

  document.addEventListener('click', function(e) {
    try {
      const now = Date.now();
      _recentClicks.push({ x: e.clientX, y: e.clientY, t: now, target: e.target });
      // Keep only clicks within last 800ms
      while (_recentClicks.length > 0 && now - _recentClicks[0].t > 800) {
        _recentClicks.shift();
      }
      if (_recentClicks.length >= 3 && (now - _lastRageClickTime > 5000)) {
        // Check if all within 50px radius of the first
        const ref = _recentClicks[0];
        const allClose = _recentClicks.every(function(c) {
          const dx = c.x - ref.x;
          const dy = c.y - ref.y;
          return Math.sqrt(dx * dx + dy * dy) <= 50;
        });
        if (allClose) {
          _lastRageClickTime = now;
          const tgt = e.target;
          sendAuditPing({
            actionType: 'rage_click',
            clickCoords: e.clientX + 'x' + e.clientY,
            clickTarget: (tgt.tagName || '').toLowerCase() + (tgt.id ? '#' + tgt.id : '') + (tgt.className ? '.' + String(tgt.className).split(' ')[0] : '')
          });
          _recentClicks.length = 0;
        }
      }
    } catch (_) {}
  }, { passive: true, capture: true });

  // ── 6. Copy/Paste Tracking ────────────────────────────────────────────
  document.addEventListener('copy', function(e) {
    try {
      const sel = window.getSelection();
      const copiedLength = sel ? sel.toString().length : 0;
      const tgt = e.target || document.activeElement;
      sendAuditPing({
        actionType: 'content_copied',
        copiedLength: copiedLength,
        sourceElement: (tgt.tagName || '').toLowerCase() + (tgt.id ? '#' + tgt.id : '')
      });
    } catch (_) {}
  }, { passive: true });

  // ── 7. External Link Tracking ─────────────────────────────────────────
  document.addEventListener('click', function(e) {
    try {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('http')) return;
      try {
        const url = new URL(href);
        if (url.hostname === window.location.hostname) return;
      } catch (_) { return; }
      sendAuditPing({
        actionType: 'outbound_link',
        href: href,
        linkText: (link.innerText || '').trim().slice(0, 80)
      });
    } catch (_) {}
  }, { passive: true, capture: true });

  // ── 8. Idle/Active Detection ──────────────────────────────────────────
  let _lastActivityTime = Date.now();
  let _isIdle = false;
  let _idleStartTime = 0;
  let _totalActiveTime = 0;
  let _totalIdleTime = 0;
  let _idleCheckInterval = null;

  function _onUserActivity() {
    const now = Date.now();
    if (_isIdle) {
      _isIdle = false;
      const idleDur = Math.round((now - _idleStartTime) / 1000);
      _totalIdleTime += idleDur;
      sendAuditPing({
        actionType: 'user_reactivated',
        idleDuration: idleDur
      });
    }
    _lastActivityTime = now;
  }

  ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(function(evt) {
    document.addEventListener(evt, _onUserActivity, { passive: true });
  });

  _idleCheckInterval = setInterval(function() {
    try {
      const now = Date.now();
      if (!_isIdle && (now - _lastActivityTime >= 60000)) {
        _isIdle = true;
        _idleStartTime = now;
        _totalActiveTime += Math.round((now - _sessionStart) / 1000) - _totalIdleTime;
      }
    } catch (_) {}
  }, 5000);

  // ── 9. Tab Visibility ─────────────────────────────────────────────────
  let _tabHiddenTime = 0;
  let _tabSwitchCount = 0;

  document.addEventListener('visibilitychange', function() {
    try {
      if (document.hidden || document.visibilityState === 'hidden') {
        _tabHiddenTime = Date.now();
      } else {
        if (_tabHiddenTime > 0) {
          _tabSwitchCount++;
          const hiddenDur = Math.round((Date.now() - _tabHiddenTime) / 1000);
          sendAuditPing({
            actionType: 'tab_refocused',
            hiddenDuration: hiddenDur
          });
          _tabHiddenTime = 0;
        }
      }
    } catch (_) {}
  });

  // ── 10. Device Orientation ────────────────────────────────────────────
  let _currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

  function _checkOrientationChange() {
    try {
      const newO = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      if (newO !== _currentOrientation) {
        _currentOrientation = newO;
        sendAuditPing({
          actionType: 'orientation_change',
          orientation: newO
        });
      }
    } catch (_) {}
  }

  if ('onorientationchange' in window) {
    window.addEventListener('orientationchange', _checkOrientationChange);
  } else {
    window.addEventListener('resize', _checkOrientationChange, { passive: true });
  }

  // ── 11. Form Interaction Tracking ─────────────────────────────────────
  let _formInteractionCount = 0;

  document.addEventListener('focusin', function(e) {
    try {
      const el = e.target;
      if (!el || !el.tagName) return;
      const tag = el.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
      _formInteractionCount++;
      sendAuditPing({
        actionType: 'form_focus',
        fieldId: el.id || el.name || tag,
        fieldType: el.type || tag
      });
    } catch (_) {}
  }, { passive: true });

  // ── 12. Error Tracking ────────────────────────────────────────────────
  let _errorCount = 0;
  const _maxErrors = 5;

  const _prevOnError = window.onerror;
  window.onerror = function(msg, source, lineno, colno, error) {
    try {
      if (_errorCount < _maxErrors) {
        _errorCount++;
        sendAuditPing({
          actionType: 'js_error',
          errorMessage: String(msg).slice(0, 200),
          errorSource: (source || '') + ':' + (lineno || 0) + ':' + (colno || 0)
        });
      }
    } catch (_) {}
    if (typeof _prevOnError === 'function') return _prevOnError.apply(this, arguments);
  };

  window.addEventListener('unhandledrejection', function(e) {
    try {
      if (_errorCount < _maxErrors) {
        _errorCount++;
        sendAuditPing({
          actionType: 'js_error',
          errorMessage: String(e.reason || e.message || 'unhandled rejection').slice(0, 200),
          errorSource: 'unhandledrejection'
        });
      }
    } catch (_) {}
  });

  // ── Session End Ping (beforeunload) ───────────────────────────────────
  window.addEventListener('beforeunload', function() {
    try {
      const now = Date.now();
      const sessionDuration = Math.round((now - _sessionStart) / 1000);
      // Calculate final active/idle times
      let finalActiveTime = _totalActiveTime;
      let finalIdleTime = _totalIdleTime;
      if (_isIdle) {
        finalIdleTime += Math.round((now - _idleStartTime) / 1000);
      } else {
        finalActiveTime = sessionDuration - finalIdleTime;
      }

      const payload = {
        actionType: 'session_end',
        sessionDuration: sessionDuration,
        totalClicks: _totalClicks,
        totalScrolls: _totalScrolls,
        totalKeystrokes: _totalKeystrokes,
        maxScrollDepth: _maxScrollDepth,
        totalActiveTime: finalActiveTime,
        totalIdleTime: finalIdleTime,
        tabSwitchCount: _tabSwitchCount,
        formInteractionCount: _formInteractionCount
      };

      // Use sendBeacon for reliability on page unload
      const telemetry = getClientTelemetry();
      const beaconPayload = Object.assign({}, telemetry, {
        sessionId: _sessionId,
        pageSequence: _pageSequence
      }, payload);
      if (_previousPage) beaconPayload.previousPage = _previousPage;

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/visit', JSON.stringify(beaconPayload));
      } else {
        // Fallback: sync XHR
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/visit', false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(beaconPayload));
      }
    } catch (_) {}
  });

  } catch (_globalBehavioralError) {
    // All behavioral analytics wrapped — silent failure
  }

})();
