


import { Task } from '../types/Task'

export const calculatePriority = (task: Task): number => {
  const now = new Date();

  const daysSinceLastDone = task.lastCompleted
    ? (now.getTime() - task.lastCompleted.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  const daysUntilDue = (task.nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  let priority = 0;

  // Overdue tasks
  if (daysUntilDue < 0) {
    priority += 1000 + Math.abs(daysUntilDue) * 10;
  }

  // Never completed
  if (!task.lastCompleted) {
    priority += 500;
  }

  // Long gaps since last completion
  if (daysSinceLastDone !== Infinity) {
    priority += daysSinceLastDone * 2;
  }

  // Streak effect (good streak lowers priority)
  priority -= task.streak * 5;

  // Difficulty increases priority
  priority += task.difficulty * 3;

  // Importance & urgency scaling
  const importanceWeight = 0.6;
  const urgencyWeight = 0.4;
  priority += (task.importance * importanceWeight) + (task.urgency * urgencyWeight);

  return Math.max(1, Math.floor(priority));
};


export const getTaskStatus = (task: Task): string => {
  const now = new Date();
  const daysOverdue = (now.getTime() - task.nextDue.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysOverdue > 7) return 'urgent';
  if (daysOverdue > 0) return 'overdue';
  if (!task.lastCompleted) return 'new';
  return 'scheduled';
};