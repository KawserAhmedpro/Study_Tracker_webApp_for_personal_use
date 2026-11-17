/**
 * StudyTracker — Daily Study Planner & Target Tracker Service
 * Handles task CRUD, status transitions, recurring plans,
 * session-task associations, and completion rate calculations.
 */

import { get, getAll, getAllByIndex, put, remove, STORES } from '../db/database.js';
import { validatePlannedTask } from '../db/schema.js';
import { generateId } from '../utils/idUtils.js';
import {
  getLocalDateString,
  offsetDateString,
  getPastNDays,
  formatDisplayDate,
  formatWeekday
} from '../utils/dateUtils.js';
import { getAllSessions } from './studyService.js';
import { getAllSubjects } from './subjectService.js';

/**
 * Triggers a global event when planned tasks are created, updated, or removed.
 */
function notifyTasksChanged() {
  window.dispatchEvent(new CustomEvent('studytracker:tasks-changed'));
}

/**
 * Priority sorting weight (high > medium > low).
 */
const PRIORITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1
};

/**
 * Creates and persists a new planned study task.
 * @param {Object} data
 * @param {string} data.title - Required task title
 * @param {string} [data.subjectId] - Optional subject ID
 * @param {string} [data.description] - Optional notes/description
 * @param {string} data.targetDate - Target calendar date (YYYY-MM-DD)
 * @param {number|null} [data.targetDurationSeconds] - Optional target duration in seconds
 * @param {'low'|'medium'|'high'} [data.priority='medium'] - Task priority
 * @param {'pending'|'completed'} [data.status='pending']
 * @param {string|null} [data.sourceTaskId] - Original task ID if planned again
 * @returns {Promise<Object>}
 */
export async function createTask(data) {
  const now = new Date().toISOString();
  const targetDate = data.targetDate || getLocalDateString(new Date());

  let targetDuration = null;
  if (typeof data.targetDurationSeconds === 'number' && !isNaN(data.targetDurationSeconds) && data.targetDurationSeconds > 0) {
    targetDuration = Math.floor(data.targetDurationSeconds);
  }

  const task = {
    id: data.id || generateId(),
    title: (data.title || '').trim(),
    subjectId: data.subjectId ? String(data.subjectId) : null,
    description: (data.description || '').trim(),
    targetDate: targetDate,
    targetDurationSeconds: targetDuration,
    priority: ['low', 'medium', 'high'].includes(data.priority) ? data.priority : 'medium',
    status: data.status === 'completed' ? 'completed' : 'pending',
    completedAt: data.status === 'completed' ? (data.completedAt || now) : null,
    sourceTaskId: data.sourceTaskId ? String(data.sourceTaskId) : null,
    createdAt: data.createdAt || now,
    updatedAt: now
  };

  const validation = validatePlannedTask(task);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  await put(STORES.PLANNED_TASKS, task);
  notifyTasksChanged();
  return task;
}

/**
 * Retrieves a single task by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getTaskById(id) {
  if (!id) return null;
  return await get(STORES.PLANNED_TASKS, id);
}

/**
 * Retrieves all planned tasks in the database.
 * @returns {Promise<Array<Object>>}
 */
export async function getAllTasks() {
  const all = await getAll(STORES.PLANNED_TASKS);
  return sortTasks(all);
}

/**
 * Retrieves tasks for a specific calendar date (YYYY-MM-DD).
 * @param {string} dateStr
 * @returns {Promise<Array<Object>>}
 */
export async function getTasksByDate(dateStr) {
  if (!dateStr) return [];
  try {
    const list = await getAllByIndex(STORES.PLANNED_TASKS, 'targetDate', dateStr);
    return sortTasks(list);
  } catch (_) {
    const all = await getAllTasks();
    return sortTasks(all.filter((t) => t.targetDate === dateStr));
  }
}

/**
 * Retrieves tasks within an inclusive calendar date range.
 * @param {string} startDateStr
 * @param {string} endDateStr
 * @returns {Promise<Array<Object>>}
 */
export async function getTasksByDateRange(startDateStr, endDateStr) {
  const all = await getAllTasks();
  const filtered = all.filter((t) => t.targetDate >= startDateStr && t.targetDate <= endDateStr);
  return sortTasks(filtered);
}

/**
 * Updates an existing planned task.
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateTask(id, updates) {
  const task = await get(STORES.PLANNED_TASKS, id);
  if (!task) {
    throw new Error('Planned task not found.');
  }

  if (updates.title !== undefined) task.title = (updates.title || '').trim();
  if (updates.subjectId !== undefined) task.subjectId = updates.subjectId || null;
  if (updates.description !== undefined) task.description = (updates.description || '').trim();
  if (updates.targetDate !== undefined) task.targetDate = updates.targetDate;

  if (updates.targetDurationSeconds !== undefined) {
    if (typeof updates.targetDurationSeconds === 'number' && !isNaN(updates.targetDurationSeconds) && updates.targetDurationSeconds > 0) {
      task.targetDurationSeconds = Math.floor(updates.targetDurationSeconds);
    } else {
      task.targetDurationSeconds = null;
    }
  }

  if (updates.priority !== undefined) {
    if (['low', 'medium', 'high'].includes(updates.priority)) {
      task.priority = updates.priority;
    }
  }

  if (updates.status !== undefined) {
    if (['pending', 'completed'].includes(updates.status)) {
      task.status = updates.status;
      if (task.status === 'completed') {
        task.completedAt = updates.completedAt || task.completedAt || new Date().toISOString();
      } else {
        task.completedAt = null;
      }
    }
  }

  if (updates.sourceTaskId !== undefined) {
    task.sourceTaskId = updates.sourceTaskId || null;
  }

  task.updatedAt = new Date().toISOString();

  const validation = validatePlannedTask(task);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  await put(STORES.PLANNED_TASKS, task);
  notifyTasksChanged();
  return task;
}

/**
 * Deletes a planned task by ID.
 * Preserves historical study sessions.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteTask(id) {
  if (!id) return;
  await remove(STORES.PLANNED_TASKS, id);
  notifyTasksChanged();
}

/**
 * Marks a task as completed (Method A: Manual Completion).
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function completeTask(id) {
  return await updateTask(id, {
    status: 'completed',
    completedAt: new Date().toISOString()
  });
}

/**
 * Reopens a completed task and returns it to pending state.
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function reopenTask(id) {
  return await updateTask(id, {
    status: 'pending',
    completedAt: null
  });
}

/**
 * Re-plans an existing task onto another date (Plan Again / Add to Another Day).
 * Creates a brand new task occurrence referencing the original task ID,
 * without modifying or overwriting the original task record.
 * @param {string} originalTaskId
 * @param {string} newTargetDate - YYYY-MM-DD
 * @returns {Promise<Object>} The new task occurrence
 */
export async function planTaskAgain(originalTaskId, newTargetDate) {
  const original = await get(STORES.PLANNED_TASKS, originalTaskId);
  if (!original) {
    throw new Error('Original planned task could not be found.');
  }

  if (!newTargetDate || !/^\d{4}-\d{2}-\d{2}$/.test(newTargetDate)) {
    throw new Error('Please specify a valid new target date (YYYY-MM-DD).');
  }

  return await createTask({
    title: original.title,
    description: original.description,
    subjectId: original.subjectId,
    targetDate: newTargetDate,
    targetDurationSeconds: original.targetDurationSeconds,
    priority: original.priority,
    status: 'pending',
    sourceTaskId: original.id
  });
}

/**
 * Computes actual tracked duration for a given task ID by summing canonical
 * seconds from all completed study sessions associated with that task.
 * @param {string} taskId
 * @returns {Promise<number>} Total actual seconds tracked
 */
export async function getTaskActualDuration(taskId) {
  if (!taskId) return 0;
  const allSessions = await getAllSessions();
  const taskSessions = allSessions.filter((s) => s.taskId === taskId);
  return taskSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
}

/**
 * Retrieves tasks for a given date enriched with actual study progress,
 * subject metadata, overdue flags, and target completion stats.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<Array<Object>>}
 */
export async function getTasksWithProgress(dateStr) {
  const [tasks, allSessions, subjects] = await Promise.all([
    getTasksByDate(dateStr),
    getAllSessions(),
    getAllSubjects({ includeArchived: true })
  ]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const todayStr = getLocalDateString(new Date());

  // Aggregate actual study duration by taskId
  const durationByTaskId = new Map();
  for (const session of allSessions) {
    if (session.taskId) {
      durationByTaskId.set(
        session.taskId,
        (durationByTaskId.get(session.taskId) || 0) + (session.duration || 0)
      );
    }
  }

  return tasks.map((task) => {
    const actualSeconds = durationByTaskId.get(task.id) || 0;
    const targetSeconds = task.targetDurationSeconds || 0;
    const hasTarget = targetSeconds > 0;
    const timeProgressPercent = hasTarget ? Math.min(100, Math.round((actualSeconds / targetSeconds) * 100)) : 0;
    const isTargetReached = hasTarget ? actualSeconds >= targetSeconds : false;
    const isOverdue = task.status === 'pending' && task.targetDate < todayStr;
    const subject = task.subjectId ? subjectMap.get(task.subjectId) || null : null;

    return {
      ...task,
      subject,
      actualDurationSeconds: actualSeconds,
      hasTargetDuration: hasTarget,
      timeProgressPercent,
      isTargetReached,
      isOverdue
    };
  });
}

/**
 * Computes aggregate daily summary metrics for a specific date.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<Object>}
 */
export async function getDailyTaskSummary(dateStr) {
  const targetDate = dateStr || getLocalDateString(new Date());
  const tasks = await getTasksWithProgress(targetDate);

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const pending = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0; // 1 decimal place e.g. 66.7%

  const totalTargetSeconds = tasks.reduce((acc, t) => acc + (t.targetDurationSeconds || 0), 0);
  const totalActualSeconds = tasks.reduce((acc, t) => acc + (t.actualDurationSeconds || 0), 0);

  return {
    date: targetDate,
    displayDate: formatDisplayDate(targetDate),
    weekday: formatWeekday(targetDate, false),
    total,
    completed,
    pending,
    completionRate,
    totalTargetSeconds,
    totalActualSeconds,
    tasks
  };
}

/**
 * Retrieves historical planner records grouped by day for the past N days.
 * @param {number} [days=30]
 * @param {string} [anchorDate]
 * @returns {Promise<Array<Object>>} Array sorted newest to oldest
 */
export async function getHistoricalTaskSummary(days = 30, anchorDate) {
  const todayStr = anchorDate || getLocalDateString(new Date());
  const dateList = getPastNDays(days, todayStr); // Oldest to newest
  const allTasks = await getAllTasks();
  const allSessions = await getAllSessions();

  // Map task duration
  const durationByTaskId = new Map();
  for (const session of allSessions) {
    if (session.taskId) {
      durationByTaskId.set(
        session.taskId,
        (durationByTaskId.get(session.taskId) || 0) + (session.duration || 0)
      );
    }
  }

  // Index tasks by targetDate
  const tasksByDate = new Map();
  for (const t of allTasks) {
    if (!tasksByDate.has(t.targetDate)) {
      tasksByDate.set(t.targetDate, []);
    }
    tasksByDate.get(t.targetDate).push(t);
  }

  const summaries = dateList.map((d) => {
    const dayTasks = tasksByDate.get(d) || [];
    const total = dayTasks.length;
    const completed = dayTasks.filter((t) => t.status === 'completed').length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

    let dayActualSeconds = 0;
    for (const t of dayTasks) {
      dayActualSeconds += durationByTaskId.get(t.id) || 0;
    }

    return {
      date: d,
      displayDate: formatDisplayDate(d),
      weekday: formatWeekday(d, false),
      total,
      completed,
      pending,
      completionRate,
      actualDurationSeconds: dayActualSeconds,
      taskCount: total
    };
  });

  return summaries.reverse(); // Newest first
}

/**
 * Aggregates task completion statistics for the Statistics page and Dashboard.
 * Includes daily, weekly, and monthly completion rates and trend datasets for Chart.js.
 * @returns {Promise<Object>}
 */
export async function getTaskCompletionStats() {
  const todayStr = getLocalDateString(new Date());
  const [todaySummary, past30DaysSummary] = await Promise.all([
    getDailyTaskSummary(todayStr),
    getHistoricalTaskSummary(30, todayStr)
  ]);

  // past30DaysSummary is sorted newest to oldest. Reverse to chronological for charts
  const chronological30 = [...past30DaysSummary].reverse();
  const chronological7 = chronological30.slice(-7);

  // Weekly (Last 7 days) totals
  const weekPlanned = chronological7.reduce((acc, d) => acc + d.total, 0);
  const weekCompleted = chronological7.reduce((acc, d) => acc + d.completed, 0);
  const weeklyRate = weekPlanned > 0 ? Math.round((weekCompleted / weekPlanned) * 1000) / 10 : 0;

  // Monthly (Last 30 days) totals
  const monthPlanned = chronological30.reduce((acc, d) => acc + d.total, 0);
  const monthCompleted = chronological30.reduce((acc, d) => acc + d.completed, 0);
  const monthlyRate = monthPlanned > 0 ? Math.round((monthCompleted / monthPlanned) * 1000) / 10 : 0;

  // Trend labels (e.g. 11/18)
  const trendLabels7 = chronological7.map((d) => {
    const [, month, day] = d.date.split('-');
    return `${Number(month)}/${Number(day)}`;
  });

  const trendLabels30 = chronological30.map((d) => {
    const [, month, day] = d.date.split('-');
    return `${Number(month)}/${Number(day)}`;
  });

  return {
    today: todaySummary,
    weekly: {
      totalPlanned: weekPlanned,
      totalCompleted: weekCompleted,
      completionRate: weeklyRate
    },
    monthly: {
      totalPlanned: monthPlanned,
      totalCompleted: monthCompleted,
      completionRate: monthlyRate
    },
    trend7: {
      dates: chronological7.map((d) => d.date),
      labels: trendLabels7,
      planned: chronological7.map((d) => d.total),
      completed: chronological7.map((d) => d.completed),
      rates: chronological7.map((d) => d.completionRate)
    },
    trend30: {
      dates: chronological30.map((d) => d.date),
      labels: trendLabels30,
      planned: chronological30.map((d) => d.total),
      completed: chronological30.map((d) => d.completed),
      rates: chronological30.map((d) => d.completionRate)
    }
  };
}

/**
 * Sorts tasks by priority (high > medium > low), then by createdAt ascending.
 * @param {Array<Object>} tasks
 * @returns {Array<Object>}
 */
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const weightA = PRIORITY_WEIGHT[a.priority] || 2;
    const weightB = PRIORITY_WEIGHT[b.priority] || 2;
    if (weightB !== weightA) {
      return weightB - weightA;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

