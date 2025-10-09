import * as SQLite from "expo-sqlite";
import { Task, NewTask } from '../types/Task'
let db: SQLite.SQLiteDatabase;

export const getDB = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync("tasks.db");
  }
  return db;
};
export const initDB = async () => {
  const db = await getDB();
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      importance INTEGER,
      urgency INTEGER,
      difficulty INTEGER,
      streak INTEGER,
      lastCompleted INTEGER,
      repeatPeriod INTEGER,
      nextDue INTEGER
    );`
  );
};

// export const insertTask = (task: Task, callback?: () => void) => {
//   db.transaction(tx => {
//     tx.executeSql(
//       `INSERT INTO tasks (title, description, importance, urgency, lastExecutedAt, repeatPeriod) VALUES (?, ?, ?, ?, ?, ?);`,
//       [task.title, task.description ?? "", task.importance, task.urgency, task.lastExecutedAt, task.repeatPeriod],
//       () => callback && callback()
//     );
//   });
// };
export const insertTask = async (task: NewTask ,
  p0: () => void) => {
  const database = await getDB();
  await database.runAsync(
    `INSERT INTO tasks 
     (title, description, importance, urgency, difficulty, streak, lastCompleted, repeatPeriod, nextDue) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      task.title,
      task.description ?? "",
      task.importance,
      task.urgency,
      task.difficulty,
      0,
      null,
      // task.repeatPeriod,
      // task.nextDue.getTime(),
    ]
  );
};

// export const getTasks = (callback: (tasks: Task[]) => void) => {
//   db.transaction(tx => {
//     tx.executeSql(`SELECT * FROM tasks;`, [], (_, result) => {
//       callback(result.rows._array as Task[]);
//     });
//   });
// };
export const getTasks = async (): Promise<Task[]> => {
  const database = await getDB();
  const result = await database.getAllAsync<any>(`SELECT * FROM tasks;`);

  return result.map((row: any) => ({
    ...row,
    lastCompleted: row.lastCompleted ? new Date(row.lastCompleted) : undefined,
    nextDue: new Date(row.nextDue),
  })) as Task[];
};

export const completeTask = async (task: Task) => {
  const database = await getDB();
  const now = new Date();

  // Streak logic
  let newStreak = task.streak;
  if (task.nextDue && now.getTime() <= task.nextDue.getTime()) {
    newStreak += 1; // kept streak
  } else {
    newStreak = 0; // missed deadline
  }

  const newNextDue = new Date(now.getTime() + task.repeatPeriod * 60 * 60 * 1000);

  await database.runAsync(
    `UPDATE tasks 
     SET lastCompleted = ?, streak = ?, nextDue = ?
     WHERE id = ?;`,
    [now.getTime(), newStreak, newNextDue.getTime(), task.id]
  );
};

export const deleteTask = async (task: Task) => {
  const database = await getDB();
  await database.runAsync(
    `DELETE FROM tasks WHERE id = ?;`,
    [task.id]
  );
};

export const revertTaskCompletion = async (task: Task, previousState: { lastCompleted?: Date, streak: number, nextDue: Date }) => {
  const database = await getDB();
  await database.runAsync(
    `UPDATE tasks 
     SET lastCompleted = ?, streak = ?, nextDue = ?
     WHERE id = ?;`,
    [
      previousState.lastCompleted?.getTime() || null, 
      previousState.streak, 
      previousState.nextDue.getTime(), 
      task.id
    ]
  );
};