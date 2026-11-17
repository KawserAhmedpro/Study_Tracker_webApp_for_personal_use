import { icon } from '../components/icons.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { formatDuration } from '../utils/timeUtils.js';
import { formatTimeRange } from '../utils/dateUtils.js';
import { getDashboardData } from '../services/statisticsService.js';
import { getDailyTaskSummary } from '../services/plannerService.js';

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

      <!-- Today's Planner Summary Card -->
      <section class="card planner-dash-card" style="margin-bottom: 1.5rem;" aria-label="Today's Planner Summary">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h2 class="card-title">
            ${icon('planner', { size: 18 })}
            <span>Today's Study Plan</span>
          </h2>
          <a href="#/planner" class="btn btn-ghost btn-sm">Open Full Planner</a>
        </div>
        <div id="dash-planner-content">
          <div class="empty-state" style="padding: 1.25rem;">
            <p class="text-muted">Loading today's planned tasks...</p>
          </div>
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

    // 7. Today's Planner Summary
    const plannerContentEl = document.getElementById('dash-planner-content');
    if (plannerContentEl) {
      try {
        const planSummary = await getDailyTaskSummary();
        if (planSummary.total === 0) {
          plannerContentEl.innerHTML = `
            <div class="empty-state" style="padding: 1.5rem 1rem;">
              <div class="empty-state-icon">${icon('calendar', { size: 32 })}</div>
              <h3 class="empty-state-title" style="font-size: 0.95rem;">No tasks planned for today</h3>
              <p class="empty-state-text" style="font-size: 0.85rem; margin-bottom: 0.75rem;">Plan tomorrow's study targets or set your goals for today.</p>
              <a href="#/planner" class="btn btn-secondary btn-sm">
                ${icon('plus', { size: 14 })}
                <span>Open Planner</span>
              </a>
            </div>
          `;
        } else {
          const rate = planSummary.completionRate;
          const isAllDone = planSummary.total > 0 && planSummary.completed === planSummary.total;
          const previewTasks = planSummary.tasks.slice(0, 3);

          plannerContentEl.innerHTML = `
            <div style="padding: 0.5rem 0.25rem 0 0.25rem;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.75rem; margin-bottom: 0.85rem;">
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Planned</span>
                  <span style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${planSummary.total} tasks</span>
                </div>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Completed</span>
                  <span style="font-size: 1.25rem; font-weight: 700; color: var(--success);">${planSummary.completed}</span>
                </div>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Pending</span>
                  <span style="font-size: 1.25rem; font-weight: 700; color: var(--warning);">${planSummary.pending}</span>
                </div>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Completion Rate</span>
                  <span style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${rate}%</span>
                </div>
              </div>

              <!-- Progress Bar -->
              <div style="height: 8px; background-color: var(--bg-surface-active); border-radius: var(--radius-full); overflow: hidden; margin-bottom: 0.85rem;">
                <div style="height: 100%; width: ${Math.min(100, rate)}%; background-color: ${isAllDone ? 'var(--success)' : 'var(--primary)'}; border-radius: var(--radius-full); transition: width 0.3s ease;"></div>
              </div>

              <!-- Preview List -->
              <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                ${previewTasks.map((t) => `
                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; padding: 0.35rem 0.6rem; background-color: var(--bg-surface-hover); border-radius: var(--radius-sm);">
                    <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 0;">
                      <span style="color: ${t.status === 'completed' ? 'var(--success)' : 'var(--text-muted)'}; display: inline-flex;">
                        ${icon(t.status === 'completed' ? 'check' : 'square', { size: 14 })}
                      </span>
                      <span style="font-weight: 500; ${t.status === 'completed' ? 'text-decoration: line-through; color: var(--text-muted);' : 'color: var(--text-primary);'}; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                        ${escapeHtml(t.title)}
                      </span>
                      ${t.subject ? `<span style="font-size: 0.72rem; color: ${escapeHtml(t.subject.color)}; font-weight: 600;">• ${escapeHtml(t.subject.name)}</span>` : ''}
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; margin-left: 0.5rem;">
                      ${t.hasTargetDuration ? formatDuration(t.targetDurationSeconds) : 'No target'}
                    </span>
                  </div>
                `).join('')}
                ${planSummary.tasks.length > 3 ? `
                  <div style="text-align: right; margin-top: 0.25rem;">
                    <a href="#/planner" style="font-size: 0.8rem; color: var(--primary); text-decoration: none; font-weight: 600;">+ ${planSummary.tasks.length - 3} more task${planSummary.tasks.length - 3 === 1 ? '' : 's'} in Planner &rarr;</a>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }
      } catch (e) {
        console.warn('Failed to load dashboard planner preview:', e);
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
  window.addEventListener('studytracker:tasks-changed', handleUpdate);

  return () => {
    window.removeEventListener('studytracker:sessions-changed', handleUpdate);
    window.removeEventListener('studytracker:subjects-changed', handleUpdate);
    window.removeEventListener('studytracker:settings-changed', handleUpdate);
    window.removeEventListener('studytracker:tasks-changed', handleUpdate);
  };
}
