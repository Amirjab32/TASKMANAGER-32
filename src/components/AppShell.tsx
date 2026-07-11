import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/lib/ThemeContext";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { Task, Habit, StudyTopic, TaskStore, HabitStore, TopicStore, RecurringActivity, RecurringActivityStore } from "@/lib/store";
import { getGregorianToday, addDays } from "@/lib/shamsi";
import TopBar from "@/components/layout/TopBar";
import Sidebar from "@/components/layout/Sidebar";
import TaskManagerView from "@/views/TaskManagerView";
import KanbanView from "@/views/KanbanView";
import HabitTrackerView from "@/views/HabitTrackerView";
import SRSView from "@/views/SRSView";
import QuizTrackerView from "@/views/QuizTrackerView";

const ALL_INTERVALS = [1, 3, 7, 14, 30, 60];
const DEFAULT_STAGES = 4;

function AppContent() {
  const { bg, fg } = useThemeStyles();
  const [view, setView] = useState<"tasks" | "kanban" | "habits" | "srs" | "quiz">("tasks");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [activities, setActivities] = useState<RecurringActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTasks(TaskStore.list());
    setHabits(HabitStore.list());
    setTopics(TopicStore.list());
    setActivities(RecurringActivityStore.list());
    setLoading(false);
    const handler = () => setActivities(RecurringActivityStore.list());
    window.addEventListener("activities-updated", handler);
    return () => window.removeEventListener("activities-updated", handler);
  }, []);

  const refreshActivities = useCallback(() => {
    setActivities(RecurringActivityStore.list());
  }, []);

  const createTask = useCallback(
    (data: {
      title: string;
      priority: "low" | "medium" | "high";
      scheduled_date: string;
      comment?: string;
      tags?: string[];
      activity_id?: string | null;
    }) => {
      const task = TaskStore.create({
        ...data,
        status: "todo",
        kanban_column: "todo",
        description: "",
        elapsed_seconds: 0,
        timer_started_at: null,
        timeline_slot: null,
        timeline_date: null,
        activity_id: data.activity_id ?? null,
      });
      setTasks((prev) => [task, ...prev]);
    },
    []
  );

  const changeTaskStatus = useCallback((task: Task, status: "todo" | "in_progress" | "done") => {
    const now = Date.now();
    let extraData: Partial<Task> = { status, kanban_column: status };
    if (status === "in_progress") {
      extraData.timer_started_at = now;
    } else if (task.status === "in_progress") {
      const elapsed = task.timer_started_at ? Math.floor((now - task.timer_started_at) / 1000) : 0;
      extraData.elapsed_seconds = (task.elapsed_seconds || 0) + elapsed;
      // timer_started_at را حفظ می‌کنیم تا تایم‌لاین بداند کجا نمایش دهد
      // فقط زمان را نگه می‌داریم ولی تایمر را متوقف می‌کنیم
      extraData.timer_started_at = task.timer_started_at; // حفظ برای تایم‌لاین
    }
    const updated = TaskStore.update(task.id, extraData);
    if (updated) setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    TaskStore.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const moveKanban = useCallback((id: string, column: "todo" | "in_progress" | "done", extraData?: Partial<Task>) => {
    const task = tasks.find((t) => t.id === id);
    let finalExtraData = { kanban_column: column, status: column, ...extraData };
    
    // وقتی تسک به done می‌رود، timer_started_at را حفظ کن تا در تایم‌لاین بماند
    if (column === "done" && task?.status === "in_progress" && task.timer_started_at) {
      finalExtraData = {
        ...finalExtraData,
        timer_started_at: task.timer_started_at, // حفظ برای تایم‌لاین
      };
    }
    
    const updated = TaskStore.update(id, finalExtraData);
    if (updated) setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, [tasks]);

  const createHabit = useCallback((data: { name: string; color: string }) => {
    const habit = HabitStore.create({ ...data, completed_dates: [] });
    setHabits((prev) => [habit, ...prev]);
  }, []);

  const toggleHabit = useCallback((habit: Habit) => {
    const today = getGregorianToday();
    const dates = habit.completed_dates || [];
    const newDates = dates.includes(today) ? dates.filter((d) => d !== today) : [...dates, today];
    const updated = HabitStore.update(habit.id, { completed_dates: newDates });
    if (updated) setHabits((prev) => prev.map((h) => (h.id === habit.id ? updated : h)));
  }, []);

  const deleteHabit = useCallback((id: string) => {
    HabitStore.delete(id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const createTopic = useCallback(
    (data: { title: string; description?: string; total_stages?: number }) => {
      const today = getGregorianToday();
      const stages = data.total_stages ?? DEFAULT_STAGES;
      const topic = TopicStore.create({
        title: data.title,
        description: data.description,
        last_reviewed_date: today,
        next_review_date: addDays(today, ALL_INTERVALS[0]),
        current_interval: ALL_INTERVALS[0],
        review_count: 0,
        total_stages: stages,
      });
      setTopics((prev) =>
        [...prev, topic].sort((a, b) => (a.next_review_date || "").localeCompare(b.next_review_date || ""))
      );
    },
    []
  );

  const reviewTopic = useCallback((topic: StudyTopic) => {
    const today = getGregorianToday();
    const stages = topic.total_stages ?? DEFAULT_STAGES;
    const intervals = ALL_INTERVALS.slice(0, stages);
    const nextCount = (topic.review_count || 0) + 1;
    const interval = intervals[Math.min(nextCount, intervals.length - 1)];
    const updated = TopicStore.update(topic.id, {
      last_reviewed_date: today,
      next_review_date: addDays(today, interval),
      current_interval: interval,
      review_count: nextCount,
    });
    if (updated) {
      setTopics((prev) =>
        prev
          .map((t) => (t.id === topic.id ? updated : t))
          .sort((a, b) => (a.next_review_date || "").localeCompare(b.next_review_date || ""))
      );
    }
  }, []);

  const deleteTopic = useCallback((id: string) => {
    TopicStore.delete(id);
    setTopics((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (loading) {
    return (
      <div style={{ backgroundColor: bg, color: fg, minHeight: "100vh" }} className="flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-indigo-500" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen font-sans transition-colors duration-300" style={{ backgroundColor: bg, color: fg }}>
      <TopBar view={view} menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((o) => !o)} />
      <Sidebar open={menuOpen} view={view} onViewChange={(v) => setView(v as typeof view)} onClose={() => setMenuOpen(false)} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            {view === "tasks" && (
              <TaskManagerView tasks={tasks} activities={activities} onAdd={createTask} onStatusChange={changeTaskStatus} onDelete={deleteTask} onActivitiesChange={refreshActivities} />
            )}
            {view === "kanban" && (
              <KanbanView tasks={tasks} activities={activities} onMove={moveKanban} onTasksChange={setTasks} />
            )}
            {view === "habits" && (
              <HabitTrackerView habits={habits} onAdd={createHabit} onToggle={toggleHabit} onDelete={deleteHabit} />
            )}
            {view === "srs" && (
              <SRSView topics={topics} onAdd={createTopic} onReview={reviewTopic} onDelete={deleteTopic} />
            )}
            {view === "quiz" && <QuizTrackerView />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function AppShell() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
