import { icon } from '../components/icons.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { formatDuration } from '../utils/timeUtils.js';
import { formatTimeRange } from '../utils/dateUtils.js';
import { getDashboardData } from '../services/statisticsService.js';

export function renderDashboard() {
  return `
    <div class="dashboard-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Track your focus and stay consistent with your daily study goals.</p>
        </div>
        <div class="page-actions">
          <a href="#/timer" class="btn btn-primary btn-lg">
            ${icon('play', { size: 18 })}
            <span>Start Studying</span>
          </a>
        </div>
      </div>

      <!-- Hero Metrics Grid -->
      <section class="dashboard-hero" aria-label="Key Study Metrics">
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-label">Today's Study</span>
            <span class="metric-icon">${icon('clock', { size: 20 })}</span>
          </div>
          <div class="metric-value" id="dash-today-time">0m</div>
          <div class="metric-sub" id="dash-session-count">0 sessions completed</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-label">Daily Goal</span>
            <span class="metric-icon">${icon('target', { size: 20 })}</span>
          </div>
          <div class="metric-value" id="dash-daily-goal">4h</div>
          <div class="goal-progress-wrap">
            <div class="progress-bar-bg" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar-fill" id="dash-goal-bar" style="width: 0%;"></div>
            </div>
          </div>
          <div class="metric-sub" id="dash-goal-percent">0% completed</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-label">Current Streak</span>
            <span class="metric-icon" style="color: #f59e0b;">${icon('flame', { size: 20 })}</span>
          </div>
          <div class="metric-value" id="dash-current-streak">0 days</div>
          <div class="metric-sub" id="dash-longest-streak">Best: 0 days</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-label">Last 7 Days</span>
            <span class="metric-icon">${icon('trendingUp', { size: 20 })}</span>
          </div>
          <div class="metric-value" id="dash-week-total">0m</div>
          <div class="metric-sub" id="dash-week-avg">Daily avg: 0m</div>
        </div>
      </section>

      <!-- Two-column sections -->
      <div class="dashboard-grid">
        <!-- Today's Subject Breakdown -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              ${icon('bookOpen', { size: 18 })}
              <span>Today's Subjects</span>
            </h2>
          </div>
          <div id="dash-subjects-container">
            <div class="empty-state">
              <div class="empty-state-icon">${icon('bookOpen', { size: 36 })}</div>
              <h3 class="empty-state-title">No study time recorded today</h3>
              <p class="empty-state-text">Start your first session to see subject breakdown and track time towards your daily goal.</p>
              <a href="#/timer" class="btn btn-primary btn-sm">
                ${icon('play', { size: 14 })}
                <span>Start Now</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Today's Sessions List -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">
              ${icon('calendar', { size: 18 })}
              <span>Today's Sessions</span>
            </h2>
            <a href="#/history" class="btn btn-ghost btn-sm">View All History</a>
          </div>
          <div id="dash-sessions-container">
            <div class="empty-state">
              <div class="empty-state-icon">${icon('clock', { size: 36 })}</div>
              <h3 class="empty-state-title">No sessions yet today</h3>
              <p class="empty-state-text">Every minute counts towards your personal growth. Launch the timer whenever you are ready.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Computes metrics and updates Dashboard UI elements.
 */
async function loadAndRenderDashboard() {
  try {
    const data = await getDashboardData();

    // 1. Today's Study Time & Session Count
    const todayTimeEl = document.getElementById('dash-today-time');
    const sessionCountEl = document.getElementById('dash-session-count');
    if (todayTimeEl) todayTimeEl.textContent = formatDuration(data.todaySeconds);
    if (sessionCountEl) {
      sessionCountEl.textContent = `${data.todaySessionCount} session${data.todaySessionCount === 1 ? '' : 's'} completed`;
    }

    // 2. Daily Goal
    const goalValEl = document.getElementById('dash-daily-goal');
    const goalBarEl = document.getElementById('dash-goal-bar');
    const goalPercentEl = document.getElementById('dash-goal-percent');

    if (goalValEl) goalValEl.textContent = formatDuration(data.dailyGoalSeconds);
    if (goalBarEl) {
      const fillWidth = Math.min(100, data.goalPercent);
      goalBarEl.style.width = `${fillWidth}%`;
      goalBarEl.classList.toggle('completed', data.isGoalMet);
    }
    if (goalPercentEl) {
      goalPercentEl.textContent = `${data.goalPercent}% completed${data.isGoalMet ? ' • Goal reached! 🎉' : ''}`;
    }

    // 3. Streaks
    const currentStreakEl = document.getElementById('dash-current-streak');
    const longestStreakEl = document.getElementById('dash-longest-streak');
    if (currentStreakEl) {
      currentStreakEl.textContent = `${data.currentStreak} day${data.currentStreak === 1 ? '' : 's'}`;
    }
    if (longestStreakEl) {
      longestStreakEl.textContent = `Best: ${data.longestStreak} day${data.longestStreak === 1 ? '' : 's'}`;
    }

    // 4. Last 7 Days
    const weekTotalEl = document.getElementById('dash-week-total');
    const weekAvgEl = document.getElementById('dash-week-avg');
    if (weekTotalEl) weekTotalEl.textContent = formatDuration(data.past7TotalSec);
    if (weekAvgEl) weekAvgEl.textContent = `Daily avg: ${formatDuration(data.past7DailyAvgSec)}`;

    // 5. Today's Subject Breakdown
    const subjectsContainer = document.getElementById('dash-subjects-container');
    if (subjectsContainer) {
      if (data.todaySubjectBreakdown.length === 0) {
        subjectsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">${icon('bookOpen', { size: 36 })}</div>
            <h3 class="empty-state-title">No study time recorded today</h3>
            <p class="empty-state-text">Start your first session to see subject breakdown and track time towards your daily goal.</p>
            <a href="#/timer" class="btn btn-primary btn-sm">
              ${icon('play', { size: 14 })}
              <span>Start Now</span>
            </a>
          </div>
        `;
      } else {
        subjectsContainer.innerHTML = `
          <div class="breakdown-list">
            ${data.todaySubjectBreakdown.map((item) => `
              <div class="breakdown-item">
                <div class="breakdown-meta">
                  <div class="breakdown-subject">
                    <span class="subject-dot" style="background-color: ${escapeHtml(item.color)};"></span>
                    <span>${escapeHtml(item.name)}</span>
                  </div>
                  <span class="breakdown-time">${formatDuration(item.totalSeconds)} (${item.percent}%)</span>
                </div>
                <div class="breakdown-track">
                  <div class="breakdown-bar" style="width: ${item.percent}%; background-color: ${escapeHtml(item.color)};"></div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    // 6. Today's Sessions List
    const sessionsContainer = document.getElementById('dash-sessions-container');
    if (sessionsContainer) {
      if (data.todaySessions.length === 0) {
        sessionsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">${icon('clock', { size: 36 })}</div>
            <h3 class="empty-state-title">No sessions yet today</h3>
            <p class="empty-state-text">Every minute counts towards your personal growth. Launch the timer whenever you are ready.</p>
          </div>
        `;
      } else {
        sessionsContainer.innerHTML = `
          <div class="session-list">
            ${data.todaySessions.map((s) => `
              <div class="session-item">
                <div class="session-info">
                  <div class="session-topic">
                    <span class="subject-dot" style="background-color: ${escapeHtml(s.subject.color)}; display: inline-block; vertical-align: middle; margin-right: 4px;"></span>
                    <strong style="font-weight: 600;">${escapeHtml(s.subject.name)}:</strong>
                    <span>${escapeHtml(s.topic || 'General Study')}</span>
                  </div>
                  <div class="session-time-meta">${formatTimeRange(s.startTime, s.endTime)}</div>
                </div>
                <div class="session-duration">${formatDuration(s.duration)}</div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  }
}

export function initDashboard() {
  loadAndRenderDashboard();

  const handleUpdate = () => loadAndRenderDashboard();
  window.addEventListener('studytracker:sessions-changed', handleUpdate);
  window.addEventListener('studytracker:subjects-changed', handleUpdate);
  window.addEventListener('studytracker:settings-changed', handleUpdate);

  return () => {
    window.removeEventListener('studytracker:sessions-changed', handleUpdate);
    window.removeEventListener('studytracker:subjects-changed', handleUpdate);
    window.removeEventListener('studytracker:settings-changed', handleUpdate);
  };
}
