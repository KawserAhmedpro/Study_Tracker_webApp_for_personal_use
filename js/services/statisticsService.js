/**
 * StudyTracker — Statistics & Dashboard Aggregations Service
 * Handles streaks, daily goals, 7-day / 30-day calculations with local timezone awareness.
 */

import { getAllSessions } from './studyService.js';
import { getAllSubjects } from './subjectService.js';
import { get, STORES, DEFAULT_SETTINGS } from '../db/database.js';
import { getLocalDateString, offsetDateString, getPastNDays } from '../utils/dateUtils.js';

/**
 * Calculates current and longest study streak in days.
 * A day qualifies if it has at least one completed session with duration > 0.
 * Uses client's local calendar dates (YYYY-MM-DD) to prevent timezone drift.
 * Accurately credits cross-midnight study sessions to both calendar dates.
 * @param {Array<Object>} sessions
 * @returns {{ currentStreak: number, longestStreak: number }}
 */
export function calculateStreaks(sessions) {
  if (!sessions || sessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Set of unique calendar dates with at least one completed study session
  const studiedDates = new Set();
  for (const s of sessions) {
    if (s.date && typeof s.duration === 'number' && s.duration > 0) {
      studiedDates.add(s.date);
    }
    // If session crossed midnight, both dates qualify as active study days
    if (s.startTime && s.endTime && typeof s.duration === 'number' && s.duration > 0) {
      const startD = getLocalDateString(new Date(s.startTime));
      const endD = getLocalDateString(new Date(s.endTime));
      if (endD && endD !== startD) {
        studiedDates.add(endD);
      }
    }
  }

  if (studiedDates.size === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const todayStr = getLocalDateString(new Date());
  const yesterdayStr = offsetDateString(todayStr, -1);

  // 1. Current Streak calculation
  let currentStreak = 0;
  if (studiedDates.has(todayStr)) {
    currentStreak = 1;
    let checkDate = offsetDateString(todayStr, -1);
    while (studiedDates.has(checkDate)) {
      currentStreak++;
      checkDate = offsetDateString(checkDate, -1);
    }
  } else if (studiedDates.has(yesterdayStr)) {
    // Maintained from yesterday
    currentStreak = 1;
    let checkDate = offsetDateString(yesterdayStr, -1);
    while (studiedDates.has(checkDate)) {
      currentStreak++;
      checkDate = offsetDateString(checkDate, -1);
    }
  }

  // 2. Longest (All-Time Record) Streak calculation
  const sortedDates = Array.from(studiedDates).sort(); // Lexicographical sort works for YYYY-MM-DD
  let maxStreak = 1;
  let runningStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i - 1];
    const currDate = sortedDates[i];
    const expectedNext = offsetDateString(prevDate, 1);

    if (currDate === expectedNext) {
      runningStreak++;
      if (runningStreak > maxStreak) {
        maxStreak = runningStreak;
      }
    } else {
      runningStreak = 1;
    }
  }

  const longestStreak = Math.max(maxStreak, currentStreak);

  return { currentStreak, longestStreak };
}

/**
 * Aggregates all data required for the Dashboard view.
 * @returns {Promise<Object>}
 */
export async function getDashboardData() {
  const [allSessions, subjects, settingsRecord] = await Promise.all([
    getAllSessions(),
    getAllSubjects({ includeArchived: true }),
    get(STORES.SETTINGS, 'app_settings')
  ]);

  const settings = settingsRecord || DEFAULT_SETTINGS;
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const todayStr = getLocalDateString(new Date());

  // 1. Today's sessions & total duration using local calendar date
  const todaySessions = allSessions.filter((s) => s.date === todayStr);
  const todaySeconds = todaySessions.reduce((acc, s) => acc + (s.duration || 0), 0);

  // 2. Daily Goal & progress
  const dailyGoalSeconds = settings.dailyGoalSeconds || 14400; // default 4h
  const goalPercent = dailyGoalSeconds > 0 ? Math.min(999, Math.round((todaySeconds / dailyGoalSeconds) * 100)) : 0;
  const isGoalMet = todaySeconds >= dailyGoalSeconds && dailyGoalSeconds > 0;

  // 3. Streaks
  const { currentStreak, longestStreak } = calculateStreaks(allSessions);

  // 4. Last 7 Days (including today)
  const past7Days = getPastNDays(7, todayStr);
  const past7Set = new Set(past7Days);
  const past7Sessions = allSessions.filter((s) => past7Set.has(s.date));
  const past7TotalSec = past7Sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const past7DailyAvgSec = Math.round(past7TotalSec / 7);

  // 5. Today's Subject Breakdown
  const subjectBreakdownMap = new Map();
  for (const session of todaySessions) {
    const sid = session.subjectId;
    const dur = session.duration || 0;
    subjectBreakdownMap.set(sid, (subjectBreakdownMap.get(sid) || 0) + dur);
  }

  const todaySubjectBreakdown = Array.from(subjectBreakdownMap.entries())
    .map(([subjectId, totalSeconds]) => {
      const sub = subjectMap.get(subjectId) || { name: 'Unknown Subject', color: '#64748b' };
      const percent = todaySeconds > 0 ? Math.round((totalSeconds / todaySeconds) * 100) : 0;
      return {
        subjectId,
        name: sub.name,
        color: sub.color,
        totalSeconds,
        percent
      };
    })
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  return {
    todaySeconds,
    todaySessionCount: todaySessions.length,
    dailyGoalSeconds,
    goalPercent,
    isGoalMet,
    currentStreak,
    longestStreak,
    past7TotalSec,
    past7DailyAvgSec,
    todaySubjectBreakdown,
    todaySessions: todaySessions.map((s) => ({
      ...s,
      subject: subjectMap.get(s.subjectId) || { name: 'Unknown Subject', color: '#64748b' }
    }))
  };
}

/**
 * Calculates aggregated statistics and daily trend / subject distribution datasets for Chart.js.
 * Ensures all days in the period have a data point (zero-fill for rest days).
 * @param {number} [days=7] - Period in days (7 or 30)
 * @returns {Promise<Object>}
 */
export async function getPeriodStatistics(days = 7) {
  const [allSessions, subjects] = await Promise.all([
    getAllSessions(),
    getAllSubjects({ includeArchived: true })
  ]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const todayStr = getLocalDateString(new Date());
  const dateList = getPastNDays(days, todayStr); // Chronological array of YYYY-MM-DD
  const dateSet = new Set(dateList);

  const periodSessions = allSessions.filter((s) => dateSet.has(s.date));
  const periodTotalSec = periodSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const dailyAverageSec = Math.round(periodTotalSec / days);

  // Today's total
  const todaySessions = allSessions.filter((s) => s.date === todayStr);
  const todayTotalSec = todaySessions.reduce((acc, s) => acc + (s.duration || 0), 0);

  // Active days count in this period
  const activeDatesSet = new Set(periodSessions.filter((s) => s.duration > 0).map((s) => s.date));
  const activeDaysCount = activeDatesSet.size;
  const activeDailyAverageSec = activeDaysCount > 0 ? Math.round(periodTotalSec / activeDaysCount) : 0;

  // Streaks
  const { currentStreak, longestStreak } = calculateStreaks(allSessions);

  // Daily Trend timeline dataset (With continuous dates and zero fill)
  const dailyTotalsMap = new Map(dateList.map((d) => [d, 0]));
  for (const s of periodSessions) {
    if (dailyTotalsMap.has(s.date)) {
      dailyTotalsMap.set(s.date, dailyTotalsMap.get(s.date) + (s.duration || 0));
    }
  }

  const trendLabels = dateList.map((d) => {
    const [, month, day] = d.split('-');
    return `${Number(month)}/${Number(day)}`;
  });
  const trendDataMinutes = dateList.map((d) => Math.round((dailyTotalsMap.get(d) || 0) / 60));
  const trendDataSeconds = dateList.map((d) => dailyTotalsMap.get(d) || 0);

  // Subject distribution dataset
  const subjectTotalMap = new Map();
  for (const s of periodSessions) {
    const sid = s.subjectId;
    subjectTotalMap.set(sid, (subjectTotalMap.get(sid) || 0) + (s.duration || 0));
  }

  const distributionList = Array.from(subjectTotalMap.entries())
    .map(([sid, totalSec]) => {
      const sub = subjectMap.get(sid) || { name: 'Unknown Subject', color: '#64748b' };
      return {
        subjectId: sid,
        name: sub.name,
        color: sub.color,
        totalSeconds: totalSec,
        totalMinutes: Math.round(totalSec / 60),
        percent: periodTotalSec > 0 ? Math.round((totalSec / periodTotalSec) * 100) : 0
      };
    })
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  return {
    days,
    todayTotalSec,
    periodTotalSec,
    dailyAverageSec,
    activeDaysCount,
    activeDailyAverageSec,
    currentStreak,
    longestStreak,
    trend: {
      dates: dateList,
      labels: trendLabels,
      dataMinutes: trendDataMinutes,
      dataSeconds: trendDataSeconds
    },
    distribution: {
      labels: distributionList.map((d) => d.name),
      colors: distributionList.map((d) => d.color),
      dataMinutes: distributionList.map((d) => d.totalMinutes),
      dataSeconds: distributionList.map((d) => d.totalSeconds),
      items: distributionList
    }
  };
}
