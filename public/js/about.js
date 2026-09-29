/* ═══════════════════════════════════════════════════════════════
   VAULT PDF PORTAL — About Page Client Scripts
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── 1. Log visit to backend analytics ─────────────────────────
  async function logVisit() {
    try {
      await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: '/about' })
      });
    } catch (e) {
      // Non-blocking silent catch
    }
  }

  // ─── 2. Viewport Scroll-Reveal (IntersectionObserver) ─────────
  function initScrollReveal() {
    // If user prefers reduced motion, reveal elements immediately
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal-fade-up').forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    document.querySelectorAll('.reveal-fade-up').forEach((el) => {
      observer.observe(el);
    });
  }

  // ─── 3. Navbar Scrolled Shadow State ──────────────────────────
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    window.addEventListener(
      'scroll',
      () => {
        if (window.scrollY > 20) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      },
      { passive: true }
    );
  }

  // ─── 4. Mobile Menu Navigation Toggle ─────────────────────────
  function initMobileMenu() {
    const toggle = document.querySelector('.mobile-toggle');
    const menu = document.querySelector('.nav-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.classList.toggle('is-active');
    });

    // Close when clicking any nav link
    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        menu.classList.remove('is-active');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ─── 5. Subtle Interactive 3D Tilt on Floating Shield ────────
  function initSubtleTilt() {
    const shield = document.querySelector('.floating-shield-card');
    const visual = document.querySelector('.hero-visual-container');
    if (!shield || !visual) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.innerWidth < 1024) return; // Desktop only

    visual.addEventListener('mousemove', (e) => {
      const rect = visual.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Soft tilt limit of ±6 degrees
      const tiltX = (y / (rect.height / 2)) * -6;
      const tiltY = (x / (rect.width / 2)) * 6;

      shield.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-6px)`;
    });

    visual.addEventListener('mouseleave', () => {
      shield.style.transform = '';
    });
  }

  // ─── DOM Ready Initialization ─────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    logVisit();
    initScrollReveal();
    initHeaderScroll();
    initMobileMenu();
    initSubtleTilt();
  });
})();
