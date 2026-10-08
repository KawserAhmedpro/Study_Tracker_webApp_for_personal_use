import { icon } from '../components/icons.js';
import { formatDuration } from '../utils/timeUtils.js';
import { getPeriodStatistics } from '../services/statisticsService.js';

let trendChartInstance = null;
let distributionChartInstance = null;
let activePeriod = 7;

export function renderStatistics() {
  return `
    <div class="statistics-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Statistics & Insights</h1>
          <p class="page-subtitle">Understand your study habits and monitor your consistency over time.</p>
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
    if (!ChartJS) {
      console.warn('Chart.js is not loaded.');
      return;
    }

    // 2. Render Daily Trend Chart (Line Chart with Zero-Fill)
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
            pointHoverRadius: 6,
            pointBackgroundColor: primaryColor,
            borderWidth: 2.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const minutes = context.parsed.y;
                  return `Study Time: ${formatDuration(minutes * 60)}`;
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

  } catch (err) {
    console.error('Failed to load statistics view:', err);
  }
}

export function initStatistics() {
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
