/**
 * StudyTracker — Main Application Bootstrap & Router
 */

import { icon } from './components/icons.js';
import { toast } from './components/toast.js';
import { initDB } from './db/database.js';
import { timerService } from './services/timerService.js';
import { renderDashboard, initDashboard } from './pages/dashboard.js';
import { renderTimer, initTimer } from './pages/timer.js';
import { renderHistory, initHistory } from './pages/history.js';
import { renderStatistics, initStatistics } from './pages/statistics.js';
import { renderSettings, initSettings } from './pages/settings.js';

import { get, put, STORES } from './db/database.js';

class App {
  constructor() {
    this.currentRoute = 'dashboard';
    this.currentCleanup = null;
    this.themePreference = this._detectInitialThemePreference();
    this.theme = this._resolveTheme(this.themePreference);
    this._initMediaListener();
  }

  async init() {
    this._applyResolvedTheme(this.theme);
    this._initMobileIcons();
    this._initThemeToggle();
    this._initRouter();

    try {
      await initDB();
      // Recover active study session if page was reloaded or browser reopened
      const restored = await timerService.init();
      if (restored) {
        if (timerService.status === 'running') {
          toast.info(`Active study session for "${timerService.subject?.name || 'Subject'}" was restored from your last visit.`);
        } else if (timerService.status === 'completed') {
          toast.info(`Unsaved completed session for "${timerService.subject?.name || 'Subject'}" was restored.`);
        }
      }

      // Sync settings theme from IndexedDB if stored
      try {
        const storedSettings = await get(STORES.SETTINGS, 'app_settings');
        if (storedSettings && storedSettings.theme && storedSettings.theme !== this.themePreference) {
          // If user previously stored preference in IndexedDB, respect it
          if (!localStorage.getItem('studytracker_theme_pref')) {
            this._applyTheme(storedSettings.theme);
          }
        }
      } catch (_) {}
    } catch (err) {
      console.error('StudyTracker failed to initialize local database:', err);
      toast.error('Local storage could not be initialized.');
    }

    this._initServiceWorker();

    // Global error listener for friendly user reporting
    window.addEventListener('error', (e) => {
      console.error('StudyTracker uncaught error:', e.error);
    });

    window.addEventListener('unhandledrejection', (e) => {
      console.error('StudyTracker unhandled rejection:', e.reason);
    });
  }

  _initServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('StudyTracker ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('StudyTracker ServiceWorker registration skipped/failed:', err);
          });
      });
    }
  }

  // ==========================================
  // Theme Management (Light, Dark, System)
  // ==========================================

  _detectInitialThemePreference() {
    const savedPref = localStorage.getItem('studytracker_theme_pref');
    if (savedPref === 'light' || savedPref === 'dark' || savedPref === 'system') {
      return savedPref;
    }
    const legacy = localStorage.getItem('studytracker_theme');
    if (legacy === 'dark' || legacy === 'light') {
      return legacy;
    }
    return 'system';
  }

  _resolveTheme(pref) {
    if (pref === 'dark' || pref === 'light') {
      return pref;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  _initMediaListener() {
    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', (e) => {
        if (this.themePreference === 'system') {
          this._applyResolvedTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  _applyTheme(preference) {
    this.themePreference = preference;
    localStorage.setItem('studytracker_theme_pref', preference);
    localStorage.setItem('studytracker_theme', preference);

    const resolved = this._resolveTheme(preference);
    this._applyResolvedTheme(resolved);

    // Sync to IndexedDB asynchronously
    get(STORES.SETTINGS, 'app_settings')
      .then((settings) => {
        if (settings) {
          settings.theme = preference;
          settings.updatedAt = new Date().toISOString();
          return put(STORES.SETTINGS, settings);
        }
      })
      .catch(() => {});
  }

  _applyResolvedTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this._updateThemeButton();
    window.dispatchEvent(new CustomEvent('studytracker:theme-changed', { detail: { theme } }));
  }

  toggleTheme() {
    const next = this.theme === 'dark' ? 'light' : 'dark';
    this._applyTheme(next);
  }

  _updateThemeButton() {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    const isDark = this.theme === 'dark';
    btn.innerHTML = icon(isDark ? 'sun' : 'moon', { size: 20 });
    btn.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    btn.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
  }

  _initThemeToggle() {
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
      this._updateThemeButton();
      btn.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
  }

  // ==========================================
  // Navigation & Router
  // ==========================================

  _initMobileIcons() {
    const iconMap = {
      'm-icon-dashboard': 'dashboard',
      'm-icon-timer': 'timer',
      'm-icon-history': 'history',
      'm-icon-statistics': 'statistics',
      'm-icon-settings': 'settings'
    };

    for (const [id, iconName] of Object.entries(iconMap)) {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = icon(iconName, { size: 20 });
      }
    }
  }

  _initRouter() {
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();
  }

  _parseRoute() {
    const hash = window.location.hash || '#/dashboard';
    const clean = hash.replace(/^#\/?/, '').split('?')[0].toLowerCase();
    const validRoutes = ['dashboard', 'timer', 'history', 'statistics', 'settings'];
    return validRoutes.includes(clean) ? clean : 'dashboard';
  }

  _handleRoute() {
    const route = this._parseRoute();
    this.currentRoute = route;

    // Update active states on nav items
    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach((el) => {
      if (el.getAttribute('data-route') === route) {
        el.classList.add('active');
        el.setAttribute('aria-current', 'page');
      } else {
        el.classList.remove('active');
        el.removeAttribute('aria-current');
      }
    });

    // Render view
    this._renderView(route);
  }

  _renderView(route) {
    const container = document.getElementById('view-container');
    if (!container) return;

    if (typeof this.currentCleanup === 'function') {
      try {
        this.currentCleanup();
      } catch (err) {
        console.warn('StudyTracker error during view cleanup:', err);
      }
      this.currentCleanup = null;
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    switch (route) {
      case 'dashboard':
        container.innerHTML = renderDashboard();
        this.currentCleanup = initDashboard();
        break;
      case 'timer':
        container.innerHTML = renderTimer();
        this.currentCleanup = initTimer();
        break;
      case 'history':
        container.innerHTML = renderHistory();
        this.currentCleanup = initHistory();
        break;
      case 'statistics':
        container.innerHTML = renderStatistics();
        this.currentCleanup = initStatistics();
        break;
      case 'settings':
        container.innerHTML = renderSettings();
        this.currentCleanup = initSettings();
        break;
      default:
        container.innerHTML = renderDashboard();
        this.currentCleanup = initDashboard();
        break;
    }
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.__studyTrackerApp = new App();
  window.__studyTrackerApp.init();
});
