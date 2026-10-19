import { icon } from '../components/icons.js';
import { formatDuration } from '../utils/timeUtils.js';
import { escapeHtml } from '../utils/formatUtils.js';
import {
  getLocalDateString,
  offsetDateString,
  formatDisplayDate,
  formatTimeRange
} from '../utils/dateUtils.js';
import {
  getPeriodStatistics,
  getDayStatistics,
  getDailyBreakdown
} from '../services/statisticsService.js';

let trendChartInstance = null;
let distributionChartInstance = null;
let activePeriod = 7;
let inspectedDate = getLocalDateString(new Date());

export function renderStatistics() {
  return `
    <div class="statistics-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Statistics & Insights</h1>
          <p class="page-subtitle">Understand your study habits, monitor your consistency, and inspect daily breakdowns.</p>
        </div>
        <div class="stats-period-toggle" role="group" aria-label="Statistics period">
          <button type="button" class="period-btn active" data-period="7" id="btn-period-7">Last 7 Days</button>
          <button type="button" class="period-btn" data-period="30" id="btn-period-30">Last 30 Days</button>
        </div>
      </div>

      <!-- Overview Metric Tiles -->
      <section class="stats-summary-grid" aria-label="Key Performance Indicators">
        <div class="stat-box">
          <span class="stat-box-label">Today</span>
          <span class="stat-box-val" id="stat-today-total">0m</span>
          <span class="stat-box-sub">Current day total</span>
        </div>

        <div class="stat-box">
          <span class="stat-box-label">Selected Total</span>
          <span class="stat-box-val" id="stat-period-total">0m</span>
          <span class="stat-box-sub" id="stat-period-label">Last 7 days sum</span>
        </div>

        <div class="stat-box">
          <span class="stat-box-label">Daily Average</span>
          <span class="stat-box-val" id="stat-daily-avg">0m</span>
          <span class="stat-box-sub" id="stat-daily-avg-sub">Calendar day avg</span>
        </div>

        <div class="stat-box">
          <span class="stat-box-label">Active Days</span>
          <span class="stat-box-val" id="stat-active-days">0 / 7</span>
          <span class="stat-box-sub">Days studied</span>
        </div>

        <div class="stat-box">
          <span class="stat-box-label">Current Streak</span>
          <span class="stat-box-val" id="stat-current-streak">0 d</span>
          <span class="stat-box-sub">Consecutive days</span>
        </div>

        <div class="stat-box">
          <span class="stat-box-label">Longest Streak</span>
          <span class="stat-box-val" id="stat-longest-streak">0 d</span>
          <span class="stat-box-sub">All-time record</span>
        </div>
      </section>

      <!-- Charts Section -->
      <section class="charts-grid" aria-label="Visual Analytics">
        <!-- Daily Trend Line Chart -->
        <div class="chart-card">
          <div class="chart-card-header">
            <h2 class="card-title">
              ${icon('trendingUp', { size: 18 })}
              <span id="chart-trend-title">Daily Study Time Trend (Last 7 Days)</span>
            </h2>
            <span class="chip chip-tag" title="Click any point on the chart to inspect that specific day">Click dot to inspect</span>
          </div>
          <div class="chart-canvas-wrap">
            <canvas id="trendChartCanvas" aria-label="Daily study time chart" role="img"></canvas>
          </div>
        </div>

        <!-- Subject Distribution Doughnut Chart -->
        <div class="chart-card">
          <div class="chart-card-header">
            <h2 class="card-title">
              ${icon('bookOpen', { size: 18 })}
              <span>Subject Distribution</span>
            </h2>
          </div>
          <div class="chart-canvas-wrap">
            <canvas id="distributionChartCanvas" aria-label="Subject distribution chart" role="img"></canvas>
          </div>
        </div>
      </section>

      <!-- FEATURE: Particular Day Inspector -->
      <section class="stats-inspector-section" id="section-daily-inspector" aria-label="Daily Study Inspector">
        <div class="inspector-card">
          <div class="inspector-card-header">
            <div class="inspector-title-wrap">
              <div class="inspector-icon-badge">
                ${icon('calendar', { size: 20 })}
              </div>
              <div>
                <h2 class="card-title">Daily Study Inspector</h2>
                <p class="card-subtitle">Inspect study time and session details for any particular day.</p>
              </div>
            </div>

            <!-- Date Navigation Bar -->
            <div class="inspector-date-nav" role="toolbar" aria-label="Day navigation">
              <button type="button" class="btn btn-secondary btn-sm nav-day-btn" id="btn-day-prev" title="Previous Day" aria-label="Previous Day">
                ${icon('chevronLeft', { size: 16 })}
                <span>Prev</span>
              </button>

              <div class="inspector-date-input-wrap">
                <input type="date" id="input-inspect-date" class="form-input inspector-date-input" aria-label="Select Date to Inspect" />
              </div>

              <button type="button" class="btn btn-secondary btn-sm nav-day-btn" id="btn-day-next" title="Next Day" aria-label="Next Day">
                <span>Next</span>
                ${icon('chevronRight', { size: 16 })}
              </button>

              <button type="button" class="btn btn-outline btn-sm" id="btn-day-today" title="Jump to Today">
                Today
              </button>
            </div>
          </div>

          <!-- Inspector Dynamic Content -->
          <div id="inspector-content" class="inspector-content">
            <div class="empty-state">
              <div class="empty-state-icon">${icon('calendar', { size: 28 })}</div>
              <p>Loading daily inspection...</p>
            </div>
          </div>
        </div>
      </section>

      <!-- FEATURE: Everyday Statistics Breakdown List -->
      <section class="daily-breakdown-section" id="section-daily-breakdown" aria-label="Day by Day Breakdown">
        <div class="breakdown-card">
          <div class="breakdown-card-header">
            <div class="breakdown-title-wrap">
              <div class="breakdown-icon-badge">
                ${icon('history', { size: 20 })}
              </div>
              <div>
                <h2 class="card-title" id="daily-breakdown-title">Day-by-Day Breakdown (Last 7 Days)</h2>
                <p class="card-subtitle">Everyday's individual statistics. Click any day to inspect full details above.</p>
              </div>
            </div>
          </div>

          <div id="daily-breakdown-container" class="daily-breakdown-list">
            <div class="empty-state">
              <p>Loading daily breakdown...</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

/**
 * Destroys existing Chart.js instances to avoid memory leaks and canvas conflicts.
 */
function destroyCharts() {
  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }
  if (distributionChartInstance) {
    distributionChartInstance.destroy();
    distributionChartInstance = null;
  }
}

/**
 * Renders the Daily Study Inspector content for a selected calendar date.
 * @param {string} dateStr - 'YYYY-MM-DD'
 */
async function renderDayInspector(dateStr) {
  const container = document.getElementById('inspector-content');
  const dateInput = document.getElementById('input-inspect-date');
  if (dateInput) {
    dateInput.value = dateStr;
  }
  if (!container) return;

  try {
    const stats = await getDayStatistics(dateStr);
    const todayStr = getLocalDateString(new Date());
    const isToday = stats.date === todayStr;

    // If no study time on this date
    if (stats.totalSeconds === 0) {
      container.innerHTML = `
        <div class="inspector-empty-box">
          <div class="inspector-empty-icon">
            ${icon('sun', { size: 36 })}
          </div>
          <h3 class="inspector-empty-title">
            No study recorded for ${stats.displayDate} (${stats.weekday})
          </h3>
          <p class="inspector-empty-text">
            No study sessions took place on this date (${stats.date}). Take a rest, or choose another date with the date picker above.
          </p>
          ${isToday ? `
            <a href="#/timer" class="btn btn-primary btn-sm" style="margin-top: 0.5rem;">
              ${icon('play', { size: 14 })}
              <span>Start Studying Now</span>
            </a>
          ` : ''}
        </div>
      `;
      return;
    }

    // Status chip logic
    let statusChipHtml = '';
    if (stats.isGoalMet) {
      statusChipHtml = `<span class="chip chip-success">${icon('target', { size: 14 })} Goal Achieved (${stats.goalPercent}%)</span>`;
    } else if (stats.goalPercent > 0) {
      statusChipHtml = `<span class="chip chip-primary">${icon('target', { size: 14 })} ${stats.goalPercent}% of Daily Goal</span>`;
    } else {
      statusChipHtml = `<span class="chip chip-muted">Goal: ${formatDuration(stats.dailyGoalSeconds)}</span>`;
    }

    // Subject breakdown bars
    const subjectBarsHtml = stats.subjectBreakdown.map((sub) => `
      <div class="day-subject-item">
        <div class="day-subject-header">
          <div class="day-subject-name">
            <span class="day-subject-dot" style="background-color: ${sub.color};"></span>
            <span>${escapeHtml(sub.name)}</span>
          </div>
          <span class="day-subject-time">${formatDuration(sub.totalSeconds)} (${sub.percent}%)</span>
        </div>
        <div class="day-subject-track">
          <div class="day-subject-fill" style="width: ${sub.percent}%; background-color: ${sub.color};"></div>
        </div>
      </div>
    `).join('');

    // Sessions timeline
    const sessionItemsHtml = stats.sessions.map((s) => `
      <div class="day-session-item">
        <div class="day-session-top">
          <div class="day-session-range">
            ${icon('clock', { size: 14 })}
            <span>${formatTimeRange(s.startTime, s.endTime)}</span>
          </div>
          <span class="day-session-dur">${formatDuration(s.duration)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
          <span class="badge" style="background-color: ${s.subject.color}18; color: ${s.subject.color}; border: 1px solid ${s.subject.color}35;">
            ${escapeHtml(s.subject.name)}
          </span>
          ${s.topic ? `<span class="day-session-topic">${escapeHtml(s.topic)}</span>` : ''}
        </div>
        ${s.notes ? `<div class="day-session-notes">${escapeHtml(s.notes)}</div>` : ''}
      </div>
    `).join('');

    container.innerHTML = `
      <!-- Hero Summary Banner -->
      <div class="inspector-hero-banner">
        <div class="inspector-hero-top">
          <div class="inspector-day-name">
            <span>${stats.fullDate}</span>
            <span class="chip chip-tag">${stats.displayDate}</span>
          </div>
          <div>${statusChipHtml}</div>
        </div>

        <div class="inspector-metrics-grid">
          <div class="inspector-metric-box">
            <span class="inspector-metric-lbl">Total Study Time</span>
            <span class="inspector-metric-val" style="color: var(--primary);">${formatDuration(stats.totalSeconds)}</span>
            <span class="inspector-metric-sub">Across all sessions</span>
          </div>

          <div class="inspector-metric-box">
            <span class="inspector-metric-lbl">Daily Goal</span>
            <span class="inspector-metric-val">${stats.goalPercent}%</span>
            <span class="inspector-metric-sub">Target: ${formatDuration(stats.dailyGoalSeconds)}</span>
          </div>

          <div class="inspector-metric-box">
            <span class="inspector-metric-lbl">Sessions Completed</span>
            <span class="inspector-metric-val">${stats.sessionCount}</span>
            <span class="inspector-metric-sub">Logged session${stats.sessionCount === 1 ? '' : 's'}</span>
          </div>

          <div class="inspector-metric-box">
            <span class="inspector-metric-lbl">Subjects Studied</span>
            <span class="inspector-metric-val">${stats.subjectBreakdown.length}</span>
            <span class="inspector-metric-sub">Distinct subject${stats.subjectBreakdown.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <!-- 2-Column Split: Subjects Distribution & Sessions Timeline -->
      <div class="inspector-details-grid">
        <div class="inspector-detail-card">
          <h3 class="inspector-sub-title">
            ${icon('bookOpen', { size: 16 })}
            <span>Subject Breakdown</span>
          </h3>
          <div class="day-subject-list">
            ${subjectBarsHtml}
          </div>
        </div>

        <div class="inspector-detail-card">
          <h3 class="inspector-sub-title">
            ${icon('history', { size: 16 })}
            <span>Sessions on this Day (${stats.sessionCount})</span>
          </h3>
          <div class="day-session-list">
            ${sessionItemsHtml}
          </div>
        </div>
      </div>
    `;

  } catch (err) {
    console.error('Failed to render day inspector:', err);
    container.innerHTML = `<div class="empty-state"><p>Error loading day details.</p></div>`;
  }
}

/**
 * Renders the day-by-day log list for the active period (7 or 30 days).
 * @param {number} periodDays
 */
async function renderDailyBreakdownList(periodDays = 7) {
  const container = document.getElementById('daily-breakdown-container');
  const titleEl = document.getElementById('daily-breakdown-title');
  if (titleEl) {
    titleEl.textContent = `Day-by-Day Breakdown (Last ${periodDays} Days)`;
  }
  if (!container) return;

  try {
    const list = await getDailyBreakdown(periodDays);
    if (!list || list.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No daily data available.</p></div>`;
      return;
    }

    container.innerHTML = list.map((item) => {
      const isSelected = item.date === inspectedDate;
      const isToday = item.date === getLocalDateString(new Date());

      // Subject pills (top 3)
      const subjectPills = item.subjects.slice(0, 3).map((sub) => `
        <span class="daily-sub-pill" title="${escapeHtml(sub.name)}: ${formatDuration(sub.totalSeconds)}">
          <span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${sub.color};"></span>
          <span>${escapeHtml(sub.name)}</span>
        </span>
      `).join('');

      const remainingSubsCount = item.subjects.length - 3;
      const moreSubsHtml = remainingSubsCount > 0 ? `<span class="daily-sub-pill">+${remainingSubsCount} more</span>` : '';

      // Status chip
      let statusHtml = '';
      if (item.totalSeconds === 0) {
        statusHtml = `<span class="chip chip-muted">Rest Day</span>`;
      } else if (item.isGoalMet) {
        statusHtml = `<span class="chip chip-success">${icon('target', { size: 12 })} Met Goal</span>`;
      } else {
        statusHtml = `<span class="chip chip-primary">${item.goalPercent}%</span>`;
      }

      return `
        <div class="daily-row ${isSelected ? 'selected' : ''}" data-date="${item.date}" role="button" tabindex="0" title="Click to inspect ${item.date}">
          <div class="daily-row-date">
            <div>
              <div class="daily-date-weekday">
                ${item.weekdayShort}, ${item.displayDate}
                ${isToday ? `<span class="chip chip-tag" style="margin-left: 0.25rem;">Today</span>` : ''}
              </div>
              <div class="daily-date-sub">${item.date}</div>
            </div>
          </div>

          <div class="daily-row-center">
            <div class="daily-time-badge" style="${item.totalSeconds > 0 ? 'color: var(--primary);' : 'color: var(--text-muted);'}">
              ${formatDuration(item.totalSeconds)}
            </div>
            <div class="daily-subject-pills">
              ${subjectPills}
              ${moreSubsHtml}
            </div>
          </div>

          <div class="daily-row-right">
            ${statusHtml}
            <span style="font-size: 0.78rem; color: var(--text-muted); min-width: 65px; text-align: right;">
              ${item.sessionCount > 0 ? `${item.sessionCount} session${item.sessionCount === 1 ? '' : 's'}` : '—'}
            </span>
            <span class="daily-inspect-btn">${icon('chevronRight', { size: 18 })}</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to daily rows
    const rows = container.querySelectorAll('.daily-row');
    rows.forEach((row) => {
      const handleRowClick = () => {
        const targetDate = row.getAttribute('data-date');
        if (targetDate) {
          inspectDate(targetDate);
          const inspectorSection = document.getElementById('section-daily-inspector');
          if (inspectorSection) {
            inspectorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      };

      row.addEventListener('click', handleRowClick);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowClick();
        }
      });
    });

  } catch (err) {
    console.error('Failed to render daily breakdown list:', err);
    container.innerHTML = `<div class="empty-state"><p>Error loading daily breakdown.</p></div>`;
  }
}

/**
 * Selects and inspects a specific date in the UI.
 * @param {string} dateStr - 'YYYY-MM-DD'
 */
export async function inspectDate(dateStr) {
  if (!dateStr) return;
  inspectedDate = dateStr;

  // Highlight active row in the daily breakdown list
  const container = document.getElementById('daily-breakdown-container');
  if (container) {
    const rows = container.querySelectorAll('.daily-row');
    rows.forEach((r) => {
      if (r.getAttribute('data-date') === dateStr) {
        r.classList.add('selected');
      } else {
        r.classList.remove('selected');
      }
    });
  }

  await renderDayInspector(dateStr);
}

/**
 * Loads period statistics and initializes Chart.js visual charts.
 * @param {number} periodDays
 */
async function loadAndRenderStatistics(periodDays = 7) {
  try {
    const stats = await getPeriodStatistics(periodDays);

    // 1. Update Metric Tiles
    const todayTotalEl = document.getElementById('stat-today-total');
    const periodTotalEl = document.getElementById('stat-period-total');
    const periodLabelEl = document.getElementById('stat-period-label');
    const dailyAvgEl = document.getElementById('stat-daily-avg');
    const dailyAvgSubEl = document.getElementById('stat-daily-avg-sub');
    const activeDaysEl = document.getElementById('stat-active-days');
    const currentStreakEl = document.getElementById('stat-current-streak');
    const longestStreakEl = document.getElementById('stat-longest-streak');
    const trendTitleEl = document.getElementById('chart-trend-title');

    if (todayTotalEl) todayTotalEl.textContent = formatDuration(stats.todayTotalSec);
    if (periodTotalEl) periodTotalEl.textContent = formatDuration(stats.periodTotalSec);
    if (periodLabelEl) periodLabelEl.textContent = `Last ${periodDays} days sum`;
    if (dailyAvgEl) dailyAvgEl.textContent = formatDuration(stats.dailyAverageSec);
    if (dailyAvgSubEl) dailyAvgSubEl.textContent = `Active avg: ${formatDuration(stats.activeDailyAverageSec)}`;
    if (activeDaysEl) activeDaysEl.textContent = `${stats.activeDaysCount} / ${periodDays}`;
    if (currentStreakEl) currentStreakEl.textContent = `${stats.currentStreak} d`;
    if (longestStreakEl) longestStreakEl.textContent = `${stats.longestStreak} d`;
    if (trendTitleEl) trendTitleEl.textContent = `Daily Study Time Trend (Last ${periodDays} Days)`;

    // Check theme styling for chart elements
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
    const primaryColor = isDark ? '#60a5fa' : '#2563eb';
    const surfaceBorderColor = isDark ? '#1e293b' : '#ffffff';

    destroyCharts();

    // Verify Chart.js availability
    const ChartJS = window.Chart;
    if (ChartJS) {
      // 2. Render Daily Trend Chart (Line Chart with Zero-Fill and click-to-inspect)
      const trendCanvas = document.getElementById('trendChartCanvas');
      if (trendCanvas) {
        const ctx = trendCanvas.getContext('2d');
        trendChartInstance = new ChartJS(ctx, {
          type: 'line',
          data: {
            labels: stats.trend.labels,
            datasets: [{
              label: 'Study Time',
              data: stats.trend.dataMinutes,
              borderColor: primaryColor,
              backgroundColor: isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.12)',
              fill: true,
              tension: 0.35,
              pointRadius: periodDays === 30 ? 2.5 : 4.5,
              pointHoverRadius: 6.5,
              pointBackgroundColor: primaryColor,
              borderWidth: 2.5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
              if (elements && elements.length > 0) {
                const elementIndex = elements[0].index;
                const clickedDate = stats.trend.dates[elementIndex];
                if (clickedDate) {
                  inspectDate(clickedDate);
                  const inspectorSection = document.getElementById('section-daily-inspector');
                  if (inspectorSection) {
                    inspectorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }
                }
              }
            },
            onHover: (event, elements) => {
              const canvas = event.chart?.canvas;
              if (canvas) {
                canvas.style.cursor = elements && elements.length > 0 ? 'pointer' : 'default';
              }
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: (items) => {
                    if (items.length > 0) {
                      const idx = items[0].dataIndex;
                      const d = stats.trend.dates[idx];
                      return `Date: ${d}`;
                    }
                    return '';
                  },
                  label: (context) => {
                    const minutes = context.parsed.y;
                    return `Study Time: ${formatDuration(minutes * 60)} (Click to inspect)`;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: {
                  color: textColor,
                  font: { size: periodDays === 30 ? 10 : 12 },
                  maxRotation: 0,
                  autoSkip: periodDays === 30,
                  maxTicksLimit: 12
                }
              },
              y: {
                beginAtZero: true,
                grid: { color: gridColor },
                ticks: {
                  color: textColor,
                  callback: (val) => `${val}m`
                }
              }
            }
          }
        });
      }

      // 3. Render Subject Distribution Chart (Doughnut Chart)
      const distCanvas = document.getElementById('distributionChartCanvas');
      if (distCanvas) {
        const ctx = distCanvas.getContext('2d');
        const hasData = stats.distribution.dataMinutes.length > 0 && stats.periodTotalSec > 0;

        const chartLabels = hasData ? stats.distribution.labels : ['No study data'];
        const chartData = hasData ? stats.distribution.dataMinutes : [1];
        const chartColors = hasData ? stats.distribution.colors : [isDark ? '#334155' : '#e2e8f0'];

        distributionChartInstance = new ChartJS(ctx, {
          type: 'doughnut',
          data: {
            labels: chartLabels,
            datasets: [{
              data: chartData,
              backgroundColor: chartColors,
              borderColor: surfaceBorderColor,
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
              legend: {
                display: hasData,
                position: 'bottom',
                labels: {
                  color: textColor,
                  boxWidth: 12,
                  padding: 12,
                  font: { size: 12 }
                }
              },
              tooltip: {
                enabled: hasData,
                callbacks: {
                  label: (context) => {
                    const minutes = context.parsed;
                    const item = stats.distribution.items[context.dataIndex];
                    const percentStr = item ? ` (${item.percent}%)` : '';
                    return ` ${context.label}: ${formatDuration(minutes * 60)}${percentStr}`;
                  }
                }
              }
            }
          }
        });
      }
    }

    // 4. Render Day Inspector & Daily Breakdown List
    await Promise.all([
      renderDayInspector(inspectedDate),
      renderDailyBreakdownList(periodDays)
    ]);

  } catch (err) {
    console.error('Failed to load statistics view:', err);
  }
}

export function initStatistics() {
  inspectedDate = getLocalDateString(new Date());
  loadAndRenderStatistics(activePeriod);

  // Period Toggle Handlers (7 vs 30 days)
  const btn7 = document.getElementById('btn-period-7');
  const btn30 = document.getElementById('btn-period-30');

  if (btn7) {
    btn7.addEventListener('click', () => {
      if (activePeriod === 7) return;
      activePeriod = 7;
      btn7.classList.add('active');
      if (btn30) btn30.classList.remove('active');
      loadAndRenderStatistics(7);
    });
  }

  if (btn30) {
    btn30.addEventListener('click', () => {
      if (activePeriod === 30) return;
      activePeriod = 30;
      btn30.classList.add('active');
      if (btn7) btn7.classList.remove('active');
      loadAndRenderStatistics(30);
    });
  }

  // Date Inspector Navigation Handlers
  const dateInput = document.getElementById('input-inspect-date');
  const btnPrev = document.getElementById('btn-day-prev');
  const btnNext = document.getElementById('btn-day-next');
  const btnToday = document.getElementById('btn-day-today');

  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected) {
        inspectDate(selected);
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      const prevDate = offsetDateString(inspectedDate, -1);
      inspectDate(prevDate);
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const nextDate = offsetDateString(inspectedDate, 1);
      inspectDate(nextDate);
    });
  }

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      const todayStr = getLocalDateString(new Date());
      inspectDate(todayStr);
    });
  }

  // React to background session, subject, or theme changes
  const handleUpdate = () => loadAndRenderStatistics(activePeriod);
  const handleThemeUpdate = () => loadAndRenderStatistics(activePeriod);
  window.addEventListener('studytracker:sessions-changed', handleUpdate);
  window.addEventListener('studytracker:subjects-changed', handleUpdate);
  window.addEventListener('studytracker:theme-changed', handleThemeUpdate);

  return () => {
    window.removeEventListener('studytracker:sessions-changed', handleUpdate);
    window.removeEventListener('studytracker:subjects-changed', handleUpdate);
    window.removeEventListener('studytracker:theme-changed', handleThemeUpdate);
    destroyCharts();
  };
}
