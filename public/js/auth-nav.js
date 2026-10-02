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

    // 1. Ensure "Dashboard" link is present in all navigation menus
    const navMenus = document.querySelectorAll('.nav-menu, #nav-menu');
    navMenus.forEach(menu => {
      const existingDash = menu.querySelector('a[href="/dashboard"]');
      if (!existingDash) {
        const dashLink = document.createElement('a');
        dashLink.href = '/dashboard';
        dashLink.className = 'nav-link' + (window.location.pathname === '/dashboard' ? ' active' : '');
        dashLink.textContent = 'Dashboard';
        menu.appendChild(dashLink);
      }
    });

    // 2. Replace static "Sign In" button with dynamic User Dashboard & Sign Out in nav actions
    const navActionsContainers = document.querySelectorAll('.nav-actions');
    navActionsContainers.forEach(container => {
      const signInBtn = container.querySelector('a[href="/login"], a[href*="login"]');
      if (signInBtn) {
        // Create logged-in widget
        const userWrap = document.createElement('div');
        userWrap.className = 'nav-auth-user-wrap';
        userWrap.style.display = 'inline-flex';
        userWrap.style.alignItems = 'center';
        userWrap.style.gap = '8px';

        const dashboardBtn = document.createElement('a');
        dashboardBtn.href = '/dashboard';
        dashboardBtn.className = 'btn-nav-cta nav-user-btn';
        dashboardBtn.style.cssText = 'background:linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.3)); border:1px solid rgba(167,139,250,0.5); color:#f8fafc; font-weight:600; font-size:0.85rem; padding:6px 14px; border-radius:999px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;';
        dashboardBtn.innerHTML = `
          <span style="display:inline-block; width:8px; height:8px; background:#10b981; border-radius:50%; box-shadow:0 0 8px #10b981;"></span>
          <span>Dashboard</span>
        `;

        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.className = 'btn-nav-cta nav-global-logout-btn';
        logoutBtn.style.cssText = 'background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; font-weight:600; font-size:0.82rem; padding:6px 12px; border-radius:8px; cursor:pointer; transition:all 0.2s ease;';
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
