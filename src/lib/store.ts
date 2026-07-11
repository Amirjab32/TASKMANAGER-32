export interface Task {
  id: string;
  title: string;
  description?: string;
  comment?: string;
  tags?: string[];
  scheduled_date?: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  kanban_column: "todo" | "in_progress" | "done";
  created_date: string;
  elapsed_seconds: number;
  timer_started_at?: number | null;
  timeline_slot?: string | null;
  timeline_date?: string | null;
  activity_id?: string | null;
}
export interface RecurringActivity {
  id: string;
  name: string;
  color: string;
  created_date: string;
  tags?: string[];
}
export interface Habit {
  id: string;
  name: string;
  color: string;
  completed_dates: string[];
  created_date: string;
}
export interface StudyTopic {
  id: string;
  title: string;
  description?: string;
  last_reviewed_date?: string;
  next_review_date?: string;
  current_interval: number;
  review_count: number;
  total_stages: number;
  created_date: string;
}
export interface QuizSubject {
  id: string;
  name: string;
  color: string;
  chapters: QuizChapter[];
  created_date: string;
}
export interface QuizChapter {
  id: string;
  name: string;
}
export interface QuizEntry {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  count: number;
  date: string;
  note?: string;
  created_date: string;
}
export interface TimelineActivityEntry {
  id: string;
  activity_id: string;
  date: string;
  from_time: string;
  to_time: string;
  note?: string;
  created_date: string;
  slot_ids: string[];
  duration_seconds?: number;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
function getToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function getStore<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function setStore<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

const TASKS_KEY = "focusflow_tasks";
export const TaskStore = {
  list(): Task[] {
    return getStore<Task>(TASKS_KEY).sort(
      (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
    );
  },
  create(data: Omit<Task, "id" | "created_date">): Task {
    const task: Task = { ...data, id: generateId(), created_date: getToday() };
    const tasks = getStore<Task>(TASKS_KEY);
    tasks.unshift(task);
    setStore(TASKS_KEY, tasks);
    return task;
  },
  update(id: string, data: Partial<Task>): Task | null {
    const tasks = getStore<Task>(TASKS_KEY);
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...data };
    setStore(TASKS_KEY, tasks);
    return tasks[idx];
  },
  delete(id: string): void {
    const tasks = getStore<Task>(TASKS_KEY).filter((t) => t.id !== id);
    setStore(TASKS_KEY, tasks);
  },
};

const RECURRING_KEY = "focusflow_recurring_activities";
export const RecurringActivityStore = {
  list(): RecurringActivity[] {
    return getStore<RecurringActivity>(RECURRING_KEY).sort(
      (a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
    );
  },
  create(data: Omit<RecurringActivity, "id" | "created_date">): RecurringActivity {
    const item: RecurringActivity = { ...data, id: generateId(), created_date: getToday() };
    const list = getStore<RecurringActivity>(RECURRING_KEY);
    list.push(item);
    setStore(RECURRING_KEY, list);
    return item;
  },
  update(id: string, data: Partial<RecurringActivity>): RecurringActivity | null {
    const list = getStore<RecurringActivity>(RECURRING_KEY);
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data };
    setStore(RECURRING_KEY, list);
    return list[idx];
  },
  delete(id: string): void {
    const list = getStore<RecurringActivity>(RECURRING_KEY).filter((r) => r.id !== id);
    setStore(RECURRING_KEY, list);
  },
  addTag(activityId: string, tag: string): RecurringActivity | null {
    const list = getStore<RecurringActivity>(RECURRING_KEY);
    const idx = list.findIndex((r) => r.id === activityId);
    if (idx === -1) return null;
    const existingTags = list[idx].tags ?? [];
    if (!existingTags.includes(tag)) {
      list[idx].tags = [...existingTags, tag];
      setStore(RECURRING_KEY, list);
    }
    return list[idx];
  },
};

const HABITS_KEY = "focusflow_habits";
export const HabitStore = {
  list(): Habit[] {
    return getStore<Habit>(HABITS_KEY).sort(
      (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
    );
  },
  create(data: Omit<Habit, "id" | "created_date">): Habit {
    const habit: Habit = { ...data, id: generateId(), created_date: getToday() };
    const habits = getStore<Habit>(HABITS_KEY);
    habits.unshift(habit);
    setStore(HABITS_KEY, habits);
    return habit;
  },
  update(id: string, data: Partial<Habit>): Habit | null {
    const habits = getStore<Habit>(HABITS_KEY);
    const idx = habits.findIndex((h) => h.id === id);
    if (idx === -1) return null;
    habits[idx] = { ...habits[idx], ...data };
    setStore(HABITS_KEY, habits);
    return habits[idx];
  },
  delete(id: string): void {
    const habits = getStore<Habit>(HABITS_KEY).filter((h) => h.id !== id);
    setStore(HABITS_KEY, habits);
  },
};

const TOPICS_KEY = "focusflow_topics";
export const TopicStore = {
  list(): StudyTopic[] {
    return getStore<StudyTopic>(TOPICS_KEY).sort((a, b) => {
      const ad = a.next_review_date || "9999-12-31";
      const bd = b.next_review_date || "9999-12-31";
      return ad.localeCompare(bd);
    });
  },
  create(data: Omit<StudyTopic, "id" | "created_date">): StudyTopic {
    const topic: StudyTopic = { ...data, id: generateId(), created_date: getToday() };
    const topics = getStore<StudyTopic>(TOPICS_KEY);
    topics.push(topic);
    setStore(TOPICS_KEY, topics);
    return topic;
  },
  update(id: string, data: Partial<StudyTopic>): StudyTopic | null {
    const topics = getStore<StudyTopic>(TOPICS_KEY);
    const idx = topics.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    topics[idx] = { ...topics[idx], ...data };
    setStore(TOPICS_KEY, topics);
    return topics[idx];
  },
  delete(id: string): void {
    const topics = getStore<StudyTopic>(TOPICS_KEY).filter((t) => t.id !== id);
    setStore(TOPICS_KEY, topics);
  },
};

const QUIZ_SUBJECTS_KEY = "focusflow_quiz_subjects";
export const QuizSubjectStore = {
  list(): QuizSubject[] {
    return getStore<QuizSubject>(QUIZ_SUBJECTS_KEY).sort(
      (a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
    );
  },
  create(data: Omit<QuizSubject, "id" | "created_date">): QuizSubject {
    const subject: QuizSubject = { ...data, id: generateId(), created_date: getToday() };
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY);
    subjects.push(subject);
    setStore(QUIZ_SUBJECTS_KEY, subjects);
    return subject;
  },
  update(id: string, data: Partial<QuizSubject>): QuizSubject | null {
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY);
    const idx = subjects.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    subjects[idx] = { ...subjects[idx], ...data };
    setStore(QUIZ_SUBJECTS_KEY, subjects);
    return subjects[idx];
  },
  delete(id: string): void {
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY).filter((s) => s.id !== id);
    setStore(QUIZ_SUBJECTS_KEY, subjects);
  },
  addChapter(subjectId: string, chapterName: string): QuizSubject | null {
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY);
    const idx = subjects.findIndex((s) => s.id === subjectId);
    if (idx === -1) return null;
    const chapter: QuizChapter = { id: generateId(), name: chapterName };
    subjects[idx].chapters.push(chapter);
    setStore(QUIZ_SUBJECTS_KEY, subjects);
    return subjects[idx];
  },
  removeChapter(subjectId: string, chapterId: string): QuizSubject | null {
    const subjects = getStore<QuizSubject>(QUIZ_SUBJECTS_KEY);
    const idx = subjects.findIndex((s) => s.id === subjectId);
    if (idx === -1) return null;
    subjects[idx].chapters = subjects[idx].chapters.filter((c) => c.id !== chapterId);
    setStore(QUIZ_SUBJECTS_KEY, subjects);
    return subjects[idx];
  },
};

const QUIZ_ENTRIES_KEY = "focusflow_quiz_entries";
export const QuizEntryStore = {
  list(): QuizEntry[] {
    return getStore<QuizEntry>(QUIZ_ENTRIES_KEY).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  },
  listByDate(date: string): QuizEntry[] {
    return getStore<QuizEntry>(QUIZ_ENTRIES_KEY)
      .filter((e) => e.date === date)
      .sort((a, b) => b.created_date.localeCompare(a.created_date));
  },
  listByRange(from: string, to: string): QuizEntry[] {
    return getStore<QuizEntry>(QUIZ_ENTRIES_KEY)
      .filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  create(data: Omit<QuizEntry, "id" | "created_date">): QuizEntry {
    const entry: QuizEntry = { ...data, id: generateId(), created_date: getToday() };
    const entries = getStore<QuizEntry>(QUIZ_ENTRIES_KEY);
    entries.push(entry);
    setStore(QUIZ_ENTRIES_KEY, entries);
    return entry;
  },
  delete(id: string): void {
    const entries = getStore<QuizEntry>(QUIZ_ENTRIES_KEY).filter((e) => e.id !== id);
    setStore(QUIZ_ENTRIES_KEY, entries);
  },
};

const TIMELINE_ENTRIES_KEY = "focusflow_timeline_entries";
export const TimelineEntryStore = {
  list(): TimelineActivityEntry[] {
    return getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY);
  },
  listByDate(date: string): TimelineActivityEntry[] {
    return getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY).filter((e) => e.date === date);
  },
  listByRange(from: string, to: string): TimelineActivityEntry[] {
    return getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY).filter(
      (e) => e.date >= from && e.date <= to
    );
  },
  create(data: Omit<TimelineActivityEntry, "id" | "created_date">): TimelineActivityEntry {
    const entry: TimelineActivityEntry = { ...data, id: generateId(), created_date: getToday() };
    const list = getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY);
    list.push(entry);
    setStore(TIMELINE_ENTRIES_KEY, list);
    return entry;
  },
  delete(id: string): void {
    const list = getStore<TimelineActivityEntry>(TIMELINE_ENTRIES_KEY).filter((e) => e.id !== id);
    setStore(TIMELINE_ENTRIES_KEY, list);
  },
};
