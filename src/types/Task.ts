
export interface Task {
    id: string;
    title: string;
    description?: string;
    category: string;
    baseInterval: number;
    lastCompleted?: Date;
    nextDue: Date;
    streak: number;
    difficulty: number;
    minInterval: number;
    maxInterval: number;
    createdAt: Date;
    updatedAt: Date;
    repeatPeriod: number;
    // Eisenhower Matrix properties
    importance: number; // 1-5 scale (1 = not important, 5 = very important)
    urgency: number;    // 1-5 scale (1 = not urgent, 5 = very urgent)
    
  }
  export interface NewTask {
    title: string;
    description?: string;
    importance: number; // importance factor
    urgency: number;    // urgency factor
    dueDate?: Date;           // optional deadline
    difficulty: number;       // 1–5 scale (1 = very easy, 5 = very difficult)
  }
  export type EisenhowerQuadrant = 'do' | 'decide' | 'delegate' | 'delete';
  export type TaskStatus = 'critical' | 'high-priority' | 'medium-priority' | 'low-priority';