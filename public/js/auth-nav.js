/**
 * Vault PDF Portal - Persistent Global Authentication Navigation
 * Synchronizes user login state across all portal pages (Home, About, Contact, Unlock, Dashboard).
 */
(function() {
  'use strict';

  async function checkAndApplyAuthState() {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data && data.loggedIn && data.user) {
        applyLoggedInState(data.user);
      } else {
        applyLoggedOutState();
      }
    } catch (err) {
      // Silently ignore network failures
    }
  }

  function applyLoggedInState(user) {
    const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
    if (isAuthPage) {
      // If already logged in, redirect away from login/register to dashboard
      window.location.replace('/dashboard');
      return;
    }

    // 1. In navigation drawer (mobile), ensure "Dashboard" link is present
    const navMenus = document.querySelectorAll('.nav-menu, #nav-menu');
    navMenus.forEach(menu => {
      const existingDash = menu.querySelector('a[href="/dashboard"]');
      if (!existingDash) {
        const dashLink = document.createElement('a');
        dashLink.href = '/dashboard';
        dashLink.className = 'nav-link nav-link-auth-dash' + (window.location.pathname === '/dashboard' ? ' active' : '');
        dashLink.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Dashboard</span>
        `;
        menu.appendChild(dashLink);
      }
    });

    // 2. Replace static "Sign In" button with dynamic Dashboard pill & Sign Out in nav actions
    const navActionsContainers = document.querySelectorAll('.nav-actions');
    navActionsContainers.forEach(container => {
      const signInBtn = container.querySelector('a[href="/login"], a[href*="login"]');
      if (signInBtn) {
        const userWrap = document.createElement('div');
        userWrap.className = 'nav-auth-user-wrap';
        userWrap.style.display = 'inline-flex';
        userWrap.style.alignItems = 'center';
        userWrap.style.gap = '6px';
        userWrap.style.flexShrink = '0';

        const dashboardBtn = document.createElement('a');
        dashboardBtn.href = '/dashboard';
        dashboardBtn.className = 'btn-nav-cta nav-user-btn';
        dashboardBtn.style.cssText = 'background:#4B3832; border:1px solid #3A2B26; color:#ffffff; font-weight:600; font-size:0.82rem; padding:6px 12px; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; flex-shrink:0;';
        dashboardBtn.innerHTML = `
          <span style="display:inline-block; width:7px; height:7px; background:#1A7A38; border-radius:50%; box-shadow:0 0 4px rgba(26,122,56,0.6);"></span>
          <span>Dashboard</span>
        `;

        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.className = 'btn-nav-cta nav-global-logout-btn';
        logoutBtn.style.cssText = 'background:#FAF9FC; border:1px solid #D9D7DC; color:#4B3832; font-weight:600; font-size:0.80rem; padding:6px 10px; border-radius:8px; cursor:pointer; transition:all 0.2s ease; flex-shrink:0;';
        logoutBtn.innerHTML = '<span>Sign Out</span>';

        logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          logoutBtn.disabled = true;
          logoutBtn.innerHTML = '<span>Signing out...</span>';
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'same-origin'
            });
          } catch (e) {}
          window.location.href = '/';
        });

        userWrap.appendChild(dashboardBtn);
        userWrap.appendChild(logoutBtn);

        signInBtn.replaceWith(userWrap);
      }
    });
  }

  function applyLoggedOutState() {
    // If on a protected page like /dashboard, redirect to login
    if (window.location.pathname === '/dashboard') {
      window.location.replace('/login');
    }
  }

  // Run on DOM ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndApplyAuthState);
  } else {
    checkAndApplyAuthState();
  }
})();
