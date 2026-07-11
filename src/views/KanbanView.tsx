import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Clock, Loader2, CheckCircle2, BarChart3, List, Calendar as CalIcon,
  X, Plus, Trash2, Timer, Activity,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer,
} from "recharts";
import { Task, RecurringActivity, TaskStore, TimelineActivityEntry, TimelineEntryStore } from "@/lib/store";
import {
  toShamsiShort, toPersianDigits, getGregorianToday, addDays,
  getTodayJalali, gregorianToJalali, getSlotsForTimeRange,
} from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";
import JalaliCalendar from "@/components/shared/JalaliCalendar";
import type { DayMeta } from "@/components/shared/JalaliCalendar";

interface Props {
  tasks: Task[];
  activities: RecurringActivity[];
  onMove: (id: string, column: "todo" | "in_progress" | "done", extraData?: Partial<Task>) => void;
  onTasksChange: (tasks: Task[]) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f43f5e",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
};

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const tp = toPersianDigits;
  if (h > 0) return `${tp(h)}:${tp(pad(m))}:${tp(pad(s))}`;
  return `${tp(pad(m))}:${tp(pad(s))}`;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${toPersianDigits(h)}h ${toPersianDigits(m)}m`;
  return `${toPersianDigits(m)}m`;
}

const COLUMNS: {
  id: "todo" | "in_progress" | "done";
  label: string;
  topColor: string;
  icon: React.ElementType;
  iconColor: string;
  cardBorderColor: string;
  cardBgColor: string;
  badgeBg: string;
  badgeColor: string;
}[] = [
  {
    id: "todo", label: "در انتظار", topColor: "#94a3b8", icon: Clock,
    iconColor: "#94a3b8", cardBorderColor: "rgba(148,163,184,0.3)",
    cardBgColor: "rgba(148,163,184,0.05)", badgeBg: "rgba(148,163,184,0.15)", badgeColor: "#94a3b8",
  },
  {
    id: "in_progress", label: "در حال انجام", topColor: "#fbbf24", icon: Loader2,
    iconColor: "#fbbf24", cardBorderColor: "rgba(251,191,36,0.4)",
    cardBgColor: "rgba(251,191,36,0.06)", badgeBg: "rgba(251,191,36,0.15)", badgeColor: "#fbbf24",
  },
  {
    id: "done", label: "انجام‌شده", topColor: "#34d399", icon: CheckCircle2,
    iconColor: "#34d399", cardBorderColor: "rgba(52,211,153,0.35)",
    cardBgColor: "rgba(52,211,153,0.06)", badgeBg: "rgba(52,211,153,0.15)", badgeColor: "#34d399",
  },
];

const TIME_SLOTS = [
  { id: "00-03", label: "۱۲ شب – ۳ صبح", startH: 0, endH: 3 },
  { id: "03-06", label: "۳ صبح – ۶ صبح", startH: 3, endH: 6 },
  { id: "06-09", label: "۶ صبح – ۹ صبح", startH: 6, endH: 9 },
  { id: "09-12", label: "۹ صبح – ۱۲ ظهر", startH: 9, endH: 12 },
  { id: "12-15", label: "۱۲ ظهر – ۳ عصر", startH: 12, endH: 15 },
  { id: "15-18", label: "۳ عصر – ۶ عصر", startH: 15, endH: 18 },
  { id: "18-21", label: "۶ عصر – ۹ شب", startH: 18, endH: 21 },
  { id: "21-24", label: "۹ شب – ۱۲ شب", startH: 21, endH: 24 },
];

function getCurrentSlotId(): string {
  const h = new Date().getHours();
  for (const s of TIME_SLOTS) {
    if (h >= s.startH && h < s.endH) return s.id;
  }
  return "21-24";
}

function getTaskSlotFromTimer(task: Task): string {
  if (!task.timer_started_at) return getCurrentSlotId();
  const startDate = new Date(task.timer_started_at);
  const h = startDate.getHours();
  for (const s of TIME_SLOTS) {
    if (h >= s.startH && h < s.endH) return s.id;
  }
  return getCurrentSlotId();
}

function getTaskTimerDate(task: Task): string {
  if (!task.timer_started_at) return getGregorianToday();
  const d = new Date(task.timer_started_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Kanban Tab ────────────────────────────────────────────────────────────────
function KanbanTab({ tasks, activities, onMove }: { tasks: Task[]; activities: RecurringActivity[]; onMove: Props["onMove"] }) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  const [displaySeconds, setDisplaySeconds] = useState<Record<string, number>>({});
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    Object.values(intervalsRef.current).forEach(clearInterval);
    intervalsRef.current = {};
    const newDisplay: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.status === "in_progress" && t.timer_started_at) {
        const base = t.elapsed_seconds || 0;
        const startedAt = t.timer_started_at;
        const tick = () => {
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          setDisplaySeconds((prev) => ({ ...prev, [t.id]: base + elapsed }));
        };
        tick();
        intervalsRef.current[t.id] = setInterval(tick, 1000);
      } else {
        newDisplay[t.id] = t.elapsed_seconds || 0;
      }
    });
    setDisplaySeconds((prev) => ({ ...prev, ...newDisplay }));
    return () => { Object.values(intervalsRef.current).forEach(clearInterval); };
  }, [tasks]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const colId = result.destination.droppableId as "todo" | "in_progress" | "done";
    const taskId = result.draggableId;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const now = Date.now();
    let extraData: Partial<Task> = {};
    if (colId === "in_progress") {
      extraData = { timer_started_at: now };
    } else if (task.status === "in_progress") {
      const elapsed = task.timer_started_at ? Math.floor((now - task.timer_started_at) / 1000) : 0;
      extraData = { elapsed_seconds: (task.elapsed_seconds || 0) + elapsed, timer_started_at: null };
    }
    onMove(taskId, colId, extraData);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => (t.kanban_column || "todo") === col.id);
          const ColIcon = col.icon;
          return (
            <div key={col.id} className="flex flex-col rounded-2xl"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, borderTop: `4px solid ${col.topColor}` }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${col.topColor}20` }}>
                    <ColIcon className={`h-4 w-4 ${col.id === "in_progress" ? "animate-spin" : ""}`} style={{ color: col.iconColor }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: fg }}>{col.label}</span>
                </div>
                <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: col.badgeBg, color: col.badgeColor }}>
                  {toPersianDigits(colTasks.length)}
                </span>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}
                    className="flex min-h-[220px] flex-1 flex-col gap-2 rounded-b-2xl p-3 transition-colors"
                    style={{ backgroundColor: snapshot.isDraggingOver ? `${col.topColor}0d` : "transparent" }}>
                    {colTasks.map((task, index) => {
                      const secs = displaySeconds[task.id] ?? (task.elapsed_seconds || 0);
                      const activity = activities.find((a) => a.id === task.activity_id);
                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                              className="cursor-grab rounded-xl active:cursor-grabbing overflow-hidden"
                              style={{
                                border: `1px solid ${snapshot.isDragging ? col.topColor : col.cardBorderColor}`,
                                backgroundColor: snapshot.isDragging ? bg : col.cardBgColor,
                                boxShadow: snapshot.isDragging ? `0 12px 32px rgba(0,0,0,0.35), 0 0 0 2px ${col.topColor}55` : "none",
                                ...provided.draggableProps.style,
                              }}>
                              <div className="h-0.5 w-full" style={{ backgroundColor: activity ? activity.color : col.topColor }} />
                              <div className="p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: col.badgeBg, color: col.badgeColor }}>
                                    <ColIcon className={`h-3 w-3 ${col.id === "in_progress" ? "animate-spin" : ""}`} />
                                    {col.label}
                                  </span>
                                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${PRIORITY_COLORS[task.priority]}20`, color: PRIORITY_COLORS[task.priority] }}>
                                    {PRIORITY_LABELS[task.priority]}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: activity ? activity.color : PRIORITY_COLORS[task.priority] }} />
                                  <p className="flex-1 text-sm font-medium leading-snug" style={{ color: col.id === "done" ? fgMuted : fg, textDecoration: col.id === "done" ? "line-through" : "none", opacity: col.id === "done" ? 0.65 : 1 }}>
                                    {task.title}
                                  </p>
                                </div>
                                {activity && (
                                  <div className="mt-1.5 flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activity.color }} />
                                    <span className="text-[10px] font-medium" style={{ color: activity.color }}>{activity.name}</span>
                                  </div>
                                )}
                                {task.tags && task.tags.length > 0 && (
                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    {task.tags.map((t) => (
                                      <span key={t} className="rounded px-1 py-0.5 text-[9px] font-medium" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818cf8" }}>#{t}</span>
                                    ))}
                                  </div>
                                )}
                                {secs > 0 && (
                                  <div className="mt-1.5 flex items-center gap-1">
                                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                                      style={{ backgroundColor: col.id === "in_progress" ? "rgba(251,191,36,0.15)" : "rgba(128,128,128,0.1)", color: col.id === "in_progress" ? "#fbbf24" : fgMuted }}>
                                      ⏱ {formatTimer(secs)}
                                    </span>
                                  </div>
                                )}
                                {task.scheduled_date && (
                                  <p className="mt-2 text-right text-[11px]" style={{ color: fgMuted }}>
                                    📅 {toShamsiShort(task.scheduled_date)}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {colTasks.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-xs" style={{ color: `${fgMuted}55` }}>
                        <ColIcon className="h-6 w-6 opacity-30" style={{ color: col.topColor }} />
                        <span>بکش اینجا</span>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

// ─── Add Entry Modal ────────────────────────────────────────────────────────────
interface AddEntryModalProps {
  activities: RecurringActivity[];
  date: string;
  onClose: () => void;
  onAdd: (entry: TimelineActivityEntry) => void;
}

function AddActivityEntryModal({ activities, date, onClose, onAdd }: AddEntryModalProps) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  const [selectedActivityId, setSelectedActivityId] = useState(activities[0]?.id ?? "");
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("10:00");
  const [note, setNote] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const slotsCovered = getSlotsForTimeRange(fromTime, toTime);
  const selectedActivity = activities.find((a) => a.id === selectedActivityId);

  const handleSubmit = () => {
    if (!selectedActivityId || !fromTime || !toTime) return;
    if (fromTime >= toTime) return;
    const [fh, fm] = fromTime.split(":").map(Number);
    const [th, tm] = toTime.split(":").map(Number);
    const durationSeconds = (th * 60 + tm - (fh * 60 + fm)) * 60;
    const entry = TimelineEntryStore.create({
      activity_id: selectedActivityId,
      date,
      from_time: fromTime,
      to_time: toTime,
      note: note.trim() || undefined,
      slot_ids: slotsCovered,
      duration_seconds: durationSeconds,
    });
    onAdd(entry);
    onClose();
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} dir="rtl">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
      <motion.div ref={modalRef} className="relative z-10 w-full max-w-sm rounded-2xl p-5 shadow-2xl"
        style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }}
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}>
        <div className="mb-4 flex items-center justify-between">
          <span className="font-bold" style={{ color: fg }}>ثبت دستی فعالیت</span>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-3 space-y-1.5">
          <label className="text-xs font-medium" style={{ color: fgMuted }}>اکتیویتی:</label>
          <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
            {activities.map((a) => (
              <button key={a.id} type="button"
                onClick={() => setSelectedActivityId(a.id)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all"
                style={{
                  border: `1px solid ${selectedActivityId === a.id ? a.color : cardBorder}`,
                  backgroundColor: selectedActivityId === a.id ? `${a.color}20` : "transparent",
                  color: selectedActivityId === a.id ? a.color : fg,
                }}>
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                <span className="truncate text-xs font-medium">{a.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: fgMuted }}>از ساعت:</label>
            <input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: fgMuted }}>تا ساعت:</label>
            <input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
          </div>
        </div>
        {slotsCovered.length > 0 && (
          <div className="mb-3 rounded-xl p-2.5" style={{ backgroundColor: selectedActivity ? `${selectedActivity.color}10` : "rgba(99,102,241,0.08)", border: `1px solid ${selectedActivity ? `${selectedActivity.color}30` : "rgba(99,102,241,0.2)"}` }}>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: selectedActivity ? selectedActivity.color : "#818cf8" }}>
              در {toPersianDigits(slotsCovered.length)} بازه زمانی ثبت می‌شود:
            </p>
            <div className="flex flex-wrap gap-1">
              {slotsCovered.map((slotId) => {
                const slot = TIME_SLOTS.find((s) => s.id === slotId);
                return slot ? (
                  <span key={slotId} className="rounded-lg px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: selectedActivity ? `${selectedActivity.color}20` : "rgba(99,102,241,0.15)", color: selectedActivity ? selectedActivity.color : "#818cf8" }}>
                    {slot.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
        {fromTime >= toTime && fromTime && toTime && (
          <p className="mb-3 text-xs text-rose-400">ساعت پایان باید بعد از ساعت شروع باشد</p>
        )}
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="یادداشت (اختیاری)..."
          className="mb-4 w-full rounded-xl px-3 py-2 text-xs outline-none"
          style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>لغو</button>
          <button onClick={handleSubmit}
            disabled={!selectedActivityId || !fromTime || !toTime || fromTime >= toTime || slotsCovered.length === 0}
            className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40">
            ثبت
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Timeline Tab ───────────────────────────────────────────────────────────────
function TimelineTab({ tasks, activities, onTasksChange }: {
  tasks: Task[];
  activities: RecurringActivity[];
  onTasksChange: (tasks: Task[]) => void;
}) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  const todayGreg = getGregorianToday();
  const [timelineDate, setTimelineDate] = useState(todayGreg);
  const [timelineEntries, setTimelineEntries] = useState<TimelineActivityEntry[]>(() =>
    TimelineEntryStore.listByDate(todayGreg)
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const todayJalali = getTodayJalali();
  const [calJy, setCalJy] = useState(todayJalali[0]);
  const [calJm, setCalJm] = useState(todayJalali[1]);
  const dpRef = useRef<HTMLDivElement>(null);
  const currentSlotId = getCurrentSlotId();
  const [displaySeconds, setDisplaySeconds] = useState<Record<string, number>>({});
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    Object.values(intervalsRef.current).forEach(clearInterval);
    intervalsRef.current = {};
    const newDisplay: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.status === "in_progress" && t.timer_started_at) {
        const base = t.elapsed_seconds || 0;
        const startedAt = t.timer_started_at;
        const tick = () => {
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          setDisplaySeconds((prev) => ({ ...prev, [t.id]: base + elapsed }));
        };
        tick();
        intervalsRef.current[t.id] = setInterval(tick, 1000);
      } else {
        newDisplay[t.id] = t.elapsed_seconds || 0;
      }
    });
    setDisplaySeconds((prev) => ({ ...prev, ...newDisplay }));
    return () => { Object.values(intervalsRef.current).forEach(clearInterval); };
  }, [tasks]);

  useEffect(() => {
    setTimelineEntries(TimelineEntryStore.listByDate(timelineDate));
  }, [timelineDate]);

  useEffect(() => {
    if (!showDatePicker) return;
    const h = (e: MouseEvent) => {
      if (dpRef.current && !dpRef.current.contains(e.target as Node)) setShowDatePicker(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showDatePicker]);

  const deleteTimelineEntry = (id: string) => {
    TimelineEntryStore.delete(id);
    setTimelineEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleEntryAdded = (entry: TimelineActivityEntry) => {
    setTimelineEntries((prev) => [...prev, entry]);
  };

  // ─── تسک‌های in_progress برای این روز (نمایش در تایم‌لاین) ───────────────
  const inProgressTasksForDate = tasks.filter((t) => {
    if (t.status !== "in_progress") return false;
    if (!t.timer_started_at) return false;
    const timerDate = getTaskTimerDate(t);
    return timerDate === timelineDate;
  });

  // ─── تسک‌های done برای این روز – اصلاح شده ──────────────────────────────
  // تسکی که timer_started_at داشته و در روز جاری تایم‌لاین شروع شده
  // یا scheduled_date برابر با timelineDate است
  const doneTasksForDate = tasks.filter((t) => {
    if (t.status !== "done") return false;
    // اگر تایمر داشته، روز شروع تایمر را بررسی کن
    if (t.timer_started_at) {
      const timerDate = getTaskTimerDate(t);
      return timerDate === timelineDate;
    }
    // اگر تایمر نداشته، از scheduled_date استفاده کن
    if (t.scheduled_date) {
      return t.scheduled_date === timelineDate;
    }
    return false;
  });

  const removeTaskFromSlot = (taskId: string) => {
    const updated = TaskStore.update(taskId, { timeline_slot: null, timeline_date: null });
    if (updated) onTasksChange(tasks.map((t) => (t.id === taskId ? updated : t)));
  };

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="relative flex items-center gap-3 rounded-2xl p-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        <button onClick={() => setTimelineDate(addDays(timelineDate, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>◀</button>
        <button onClick={() => setShowDatePicker((s) => !s)}
          className="flex-1 text-center text-sm font-semibold"
          style={{ color: fg }}>
          📅 {toShamsiShort(timelineDate)}
          {timelineDate === todayGreg && <span className="mr-2 text-xs" style={{ color: "#818cf8" }}>(امروز)</span>}
        </button>
        <button onClick={() => setTimelineDate(addDays(timelineDate, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>▶</button>
        {showDatePicker && (
          <div ref={dpRef} className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-2xl p-4 shadow-2xl"
            style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }} dir="rtl">
            <JalaliCalendar jy={calJy} jm={calJm}
              onPrev={() => { if (calJm === 1) { setCalJy(calJy - 1); setCalJm(12); } else setCalJm(calJm - 1); }}
              onNext={() => { if (calJm === 12) { setCalJy(calJy + 1); setCalJm(1); } else setCalJm(calJm + 1); }}
              canNext={true} todayGreg={todayGreg} selectedGreg={timelineDate}
              onDayClick={(_, meta) => {
                setTimelineDate(meta.gregDate);
                setShowDatePicker(false);
                const jd = gregorianToJalali(...meta.gregDate.split("-").map(Number) as [number, number, number]);
                setCalJy(jd[0]); setCalJm(jd[1]);
              }}
              renderDay={(day, meta) => {
                const bg2 = meta.isSelected ? "#6366f1" : meta.isToday ? "rgba(99,102,241,0.15)" : "transparent";
                const col = meta.isSelected ? "#fff" : meta.isToday ? "#818cf8" : `${fgMuted}cc`;
                return <span className="flex h-full w-full items-center justify-center rounded-lg" style={{ backgroundColor: bg2, color: col }}>{toPersianDigits(day)}</span>;
              }}
            />
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: "#818cf8" }} />
          <span className="text-sm font-semibold" style={{ color: fg }}>
            خلاصه روز – {toShamsiShort(timelineDate)}
          </span>
        </div>
        {activities.length > 0 && (
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600">
            <Plus className="h-3.5 w-3.5" />
            ثبت فعالیت
          </button>
        )}
      </div>

      {/* Time slots */}
      <div className="space-y-3">
        {TIME_SLOTS.map((slot) => {
          const isCurrentSlot = slot.id === currentSlotId && timelineDate === todayGreg;
          const slotActivityEntries = timelineEntries.filter((e) => e.slot_ids.includes(slot.id));

          // تسک‌های in_progress در این اسلات
          const slotInProgressTasks = inProgressTasksForDate.filter((t) => {
            const taskSlot = getTaskSlotFromTimer(t);
            return taskSlot === slot.id;
          });

          // تسک‌های done در این اسلات - بر اساس زمان شروع تایمر
          const slotDoneTasks = doneTasksForDate.filter((t) => {
            if (t.timer_started_at) {
              const taskSlot = getTaskSlotFromTimer(t);
              return taskSlot === slot.id;
            }
            // اگر تایمر نداشته ولی scheduled_date دارد، در اسلات فعلی روز نشان می‌دهیم
            // فقط در اولین اسلات روز (09-12) برای تسک‌های بدون تایمر
            return slot.id === "09-12";
          });

          const hasContent = slotActivityEntries.length > 0 || slotInProgressTasks.length > 0 || slotDoneTasks.length > 0;

          return (
            <div key={slot.id} className="rounded-2xl overflow-hidden"
              style={{
                border: `1px solid ${isCurrentSlot ? "rgba(99,102,241,0.5)" : hasContent ? cardBorder : `${cardBorder}80`}`,
                backgroundColor: isCurrentSlot ? "rgba(99,102,241,0.04)" : hasContent ? cardBg : `${cardBg}80`,
              }}>
              {/* Slot header */}
              <div className="flex items-center gap-2 px-4 py-2.5"
                style={{ borderBottom: `1px solid ${isCurrentSlot ? "rgba(99,102,241,0.25)" : hasContent ? cardBorder : "transparent"}` }}>
                {isCurrentSlot && <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />}
                <span className="text-sm font-semibold" style={{ color: isCurrentSlot ? "#818cf8" : hasContent ? fg : fgMuted, opacity: hasContent ? 1 : 0.5 }}>
                  {slot.label}
                </span>
                {hasContent && (
                  <span className="text-xs rounded-full px-1.5 py-0.5 ml-auto"
                    style={{ backgroundColor: isCurrentSlot ? "rgba(99,102,241,0.15)" : "rgba(128,128,128,0.1)", color: isCurrentSlot ? "#818cf8" : fgMuted }}>
                    {toPersianDigits(slotActivityEntries.length + slotInProgressTasks.length + slotDoneTasks.length)}
                  </span>
                )}
              </div>

              {/* Slot content */}
              {hasContent && (
                <div className="p-3 space-y-2">
                  {/* Manual timeline entries */}
                  {slotActivityEntries.map((entry) => {
                    const act = activities.find((a) => a.id === entry.activity_id);
                    if (!act) return null;
                    return (
                      <div key={entry.id}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 group"
                        style={{ border: `1px solid ${act.color}40`, backgroundColor: `${act.color}10` }}>
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: act.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold" style={{ color: act.color }}>{act.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${act.color}20`, color: act.color }}>
                              {entry.from_time} – {entry.to_time}
                            </span>
                            {entry.duration_seconds && entry.duration_seconds > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] font-mono" style={{ color: act.color }}>
                                <Timer className="h-3 w-3" />
                                {formatDuration(entry.duration_seconds)}
                              </span>
                            )}
                            {entry.note && <span className="text-[10px]" style={{ color: fgMuted }}>· {entry.note}</span>}
                          </div>
                        </div>
                        <button onClick={() => deleteTimelineEntry(entry.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-lg"
                          style={{ color: fgMuted }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(244,63,94,0.12)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* In-progress tasks */}
                  {slotInProgressTasks.map((task) => {
                    const activity = activities.find((a) => a.id === task.activity_id);
                    const secs = displaySeconds[task.id] ?? (task.elapsed_seconds || 0);
                    return (
                      <div key={task.id}
                        className="flex items-center gap-2 rounded-xl px-3 py-2"
                        style={{
                          border: `1px solid ${activity ? `${activity.color}40` : "rgba(251,191,36,0.4)"}`,
                          backgroundColor: activity ? `${activity.color}10` : "rgba(251,191,36,0.07)",
                        }}>
                        <div className="flex h-5 w-5 items-center justify-center">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: activity ? activity.color : "#fbbf24" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {activity && (
                              <span className="text-[10px] font-semibold" style={{ color: activity.color }}>[{activity.name}]</span>
                            )}
                            <span className="text-xs font-medium truncate" style={{ color: fg }}>{task.title}</span>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                          <Timer className="h-3 w-3" />
                          {formatTimer(secs)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Done tasks – اینجا fix شد: تسک‌های انجام شده در تایم‌لاین می‌مانند */}
                  {slotDoneTasks.map((task) => {
                    const activity = activities.find((a) => a.id === task.activity_id);
                    const secs = task.elapsed_seconds || 0;
                    return (
                      <div key={task.id}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 group"
                        style={{
                          border: `1px solid ${activity ? `${activity.color}40` : "rgba(52,211,153,0.35)"}`,
                          backgroundColor: activity ? `${activity.color}08` : "rgba(52,211,153,0.06)",
                        }}>
                        <div className="flex h-5 w-5 items-center justify-center">
                          <CheckCircle2 className="h-3.5 w-3.5" style={{ color: activity ? activity.color : "#34d399" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {activity && (
                              <span className="text-[10px] font-semibold" style={{ color: activity.color }}>[{activity.name}]</span>
                            )}
                            <span className="text-xs font-medium truncate" style={{ color: fgMuted, textDecoration: "line-through" }}>{task.title}</span>
                          </div>
                        </div>
                        {secs > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "rgba(52,211,153,0.12)", color: "#34d399" }}>
                            <Timer className="inline h-3 w-3 mr-0.5" />
                            {formatDuration(secs)}
                          </span>
                        )}
                        <button onClick={() => removeTaskFromSlot(task.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-lg"
                          style={{ color: fgMuted }}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!hasContent && (
                <div className="px-4 pb-2 text-xs" style={{ color: `${fgMuted}44` }}>
                  {isCurrentSlot ? "فعالیتی در حال انجام..." : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAddModal && activities.length > 0 && (
          <AddActivityEntryModal
            activities={activities}
            date={timelineDate}
            onClose={() => setShowAddModal(false)}
            onAdd={handleEntryAdded}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stats Tab ─────────────────────────────────────────────────────────────────
function StatsTab({ tasks, activities }: { tasks: Task[]; activities: RecurringActivity[] }) {
  const { fg, fgMuted, cardBg, cardBorder, bg } = useThemeStyles();
  const todayGreg = getGregorianToday();
  const todayJalali = getTodayJalali();
  const [rangeFrom, setRangeFrom] = useState<string | null>(null);
  const [rangeTo, setRangeTo] = useState<string | null>(null);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [calJy, setCalJy] = useState(todayJalali[0]);
  const [calJm, setCalJm] = useState(todayJalali[1]);
  const [rangeConfirmed, setRangeConfirmed] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [selectedTagsByActivity, setSelectedTagsByActivity] = useState<Record<string, string[]>>({});

  const handleDayClick = useCallback((_day: number, meta: DayMeta) => {
    if (meta.gregDate > todayGreg) return;
    if (!rangeFrom || !pickingEnd) {
      setRangeFrom(meta.gregDate); setRangeTo(null); setPickingEnd(true); setRangeConfirmed(false);
    } else {
      const from = rangeFrom!;
      const to = meta.gregDate;
      if (to < from) { setRangeFrom(to); setRangeTo(from); }
      else { setRangeTo(to); }
      setPickingEnd(false); setRangeConfirmed(false);
    }
  }, [rangeFrom, pickingEnd, todayGreg]);

  const toggleActivity = (id: string) => {
    setSelectedActivityIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setRangeConfirmed(false);
  };

  const toggleTagForActivity = (activityId: string, tag: string) => {
    setSelectedTagsByActivity((prev) => {
      const current = prev[activityId] ?? [];
      const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      return { ...prev, [activityId]: updated };
    });
    setRangeConfirmed(false);
  };

  const handleConfirm = () => {
    if (rangeFrom && rangeTo) setRangeConfirmed(true);
  };

  const tasksInRange = tasks.filter((t) => {
    if (!t.scheduled_date) return false;
    if (!rangeFrom || !rangeTo) return false;
    return t.scheduled_date >= rangeFrom && t.scheduled_date <= rangeTo;
  });

  const activityFilteredTasks = tasksInRange.filter((t) => {
    if (selectedActivityIds.length === 0) return true;
    return selectedActivityIds.includes(t.activity_id ?? "");
  });

  const filteredTasks = activityFilteredTasks.filter((t) => {
    const actId = t.activity_id ?? "";
    const tagsForAct = selectedTagsByActivity[actId] ?? [];
    if (tagsForAct.length === 0) return true;
    const taskTags = t.tags ?? [];
    return tagsForAct.some((tag) => taskTags.includes(tag));
  });

  const timelineEntriesInRange = rangeFrom && rangeTo
    ? TimelineEntryStore.listByRange(rangeFrom, rangeTo).filter((e) => {
        if (selectedActivityIds.length === 0) return true;
        return selectedActivityIds.includes(e.activity_id);
      })
    : [];

  const secsByActivityFromTasks: Record<string, number> = {};
  filteredTasks.forEach((t) => {
    const actId = t.activity_id ?? "__none__";
    secsByActivityFromTasks[actId] = (secsByActivityFromTasks[actId] || 0) + (t.elapsed_seconds || 0);
  });

  const secsByActivityFromTimeline: Record<string, number> = {};
  timelineEntriesInRange.forEach((e) => {
    const secs = e.duration_seconds ?? 0;
    secsByActivityFromTimeline[e.activity_id] = (secsByActivityFromTimeline[e.activity_id] || 0) + secs;
  });

  const secsByActivity: Record<string, number> = { ...secsByActivityFromTasks };
  Object.entries(secsByActivityFromTimeline).forEach(([actId, secs]) => {
    secsByActivity[actId] = (secsByActivity[actId] || 0) + secs;
  });

  const totalTracked = Object.values(secsByActivity).reduce((a, b) => a + b, 0);

  const allDatesInRange: string[] = [];
  if (rangeFrom && rangeTo) {
    let cursor = rangeFrom;
    while (cursor <= rangeTo) { allDatesInRange.push(cursor); cursor = addDays(cursor, 1); }
  }

  const tagsByActivityId: Record<string, string[]> = {};
  activityFilteredTasks.forEach((t) => {
    const actId = t.activity_id ?? "";
    if (!tagsByActivityId[actId]) tagsByActivityId[actId] = [];
    (t.tags ?? []).forEach((tag) => {
      if (!tagsByActivityId[actId].includes(tag)) tagsByActivityId[actId].push(tag);
    });
  });

  const activeActivities = selectedActivityIds.length > 0
    ? activities.filter((a) => selectedActivityIds.includes(a.id))
    : activities.filter((a) => activityFilteredTasks.some((t) => t.activity_id === a.id));

  const pieData: { name: string; value: number; color: string }[] = [];
  Object.entries(secsByActivity).forEach(([actId, secs]) => {
    if (secs <= 0) return;
    if (actId === "__none__") {
      pieData.push({ name: "بدون اکتیویتی", value: secs, color: "#94a3b8" });
    } else {
      const act = activities.find((a) => a.id === actId);
      if (act) pieData.push({ name: act.name, value: secs, color: act.color });
    }
  });

  const totalTimelineSeconds = timelineEntriesInRange.reduce((a, e) => a + (e.duration_seconds ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: fg }}>انتخاب بازه تاریخی</span>
          <div className="flex gap-3 text-xs" style={{ color: fgMuted }}>
            {rangeFrom && <span>از: {toShamsiShort(rangeFrom)}</span>}
            {rangeTo && <span>تا: {toShamsiShort(rangeTo)}</span>}
          </div>
        </div>
        {pickingEnd && (
          <div className="rounded-xl px-3 py-2 text-center text-xs animate-pulse" style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
            حالا روز پایانی را انتخاب کن
          </div>
        )}
        <JalaliCalendar jy={calJy} jm={calJm}
          onPrev={() => { if (calJm === 1) { setCalJy(calJy - 1); setCalJm(12); } else setCalJm(calJm - 1); }}
          onNext={() => { if (calJm === 12) { setCalJy(calJy + 1); setCalJm(1); } else setCalJm(calJm + 1); }}
          canNext={calJy < todayJalali[0] || (calJy === todayJalali[0] && calJm < todayJalali[1])}
          todayGreg={todayGreg} onDayClick={handleDayClick}
          renderDay={(day, meta) => {
            const isFuture = meta.gregDate > todayGreg;
            const inRange = rangeFrom && rangeTo && meta.gregDate >= rangeFrom && meta.gregDate <= rangeTo;
            const isStart = meta.gregDate === rangeFrom, isEnd = meta.gregDate === rangeTo;
            let bgColor = "transparent", textColor = isFuture ? `${fgMuted}33` : `${fgMuted}cc`;
            if (isStart || isEnd) { bgColor = "#6366f1"; textColor = "#fff"; }
            else if (inRange) { bgColor = "rgba(99,102,241,0.15)"; textColor = "#818cf8"; }
            else if (meta.isToday) { bgColor = "rgba(99,102,241,0.1)"; textColor = "#818cf8"; }
            return <span className="flex h-full w-full items-center justify-center rounded-lg" style={{ backgroundColor: bgColor, color: textColor }}>{toPersianDigits(day)}</span>;
          }}
        />
        <div className="flex flex-wrap gap-2">
          {[{ label: "امروز", days: 1 }, { label: "هفته اخیر", days: 7 }, { label: "ماه اخیر", days: 30 }].map(({ label, days }) => (
            <button key={label} onClick={() => {
              const from = addDays(todayGreg, -(days - 1));
              setRangeFrom(from); setRangeTo(todayGreg); setPickingEnd(false); setRangeConfirmed(false);
              const jd = gregorianToJalali(...from.split("-").map(Number) as [number, number, number]);
              setCalJy(jd[0]); setCalJm(jd[1]);
            }} className="rounded-lg px-3 py-1.5 text-xs transition-all" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>
              {label}
            </button>
          ))}
        </div>
        {activities.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium" style={{ color: fgMuted }}>فیلتر اکتیویتی:</span>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => { setSelectedActivityIds([]); setSelectedTagsByActivity({}); setRangeConfirmed(false); }}
                className="rounded-lg px-3 py-1.5 text-xs transition-all"
                style={{ border: `1px solid ${selectedActivityIds.length === 0 ? "#6366f1" : cardBorder}`, backgroundColor: selectedActivityIds.length === 0 ? "rgba(99,102,241,0.15)" : "transparent", color: selectedActivityIds.length === 0 ? "#818cf8" : fgMuted }}>
                همه
              </button>
              {activities.map((a) => (
                <button key={a.id} onClick={() => toggleActivity(a.id)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all"
                  style={{ border: `1px solid ${selectedActivityIds.includes(a.id) ? a.color : cardBorder}`, backgroundColor: selectedActivityIds.includes(a.id) ? `${a.color}20` : "transparent", color: selectedActivityIds.includes(a.id) ? a.color : fgMuted }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />{a.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {activeActivities.map((act) => {
          const tagsForAct = tagsByActivityId[act.id] ?? [];
          if (tagsForAct.length === 0) return null;
          const selectedTags = selectedTagsByActivity[act.id] ?? [];
          return (
            <div key={act.id} className="space-y-1.5 rounded-xl p-2.5"
              style={{ border: `1px solid ${act.color}30`, backgroundColor: `${act.color}08` }}>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: act.color }} />
                <span className="text-xs font-medium" style={{ color: act.color }}>هشتگ‌های {act.name}:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tagsForAct.map((tag) => (
                  <button key={tag} onClick={() => toggleTagForActivity(act.id, tag)}
                    className="rounded-lg px-2.5 py-1 text-xs transition-all"
                    style={{
                      border: `1px solid ${selectedTags.includes(tag) ? act.color : `${act.color}40`}`,
                      backgroundColor: selectedTags.includes(tag) ? `${act.color}20` : "transparent",
                      color: selectedTags.includes(tag) ? act.color : fgMuted,
                    }}>
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <button onClick={handleConfirm} disabled={!rangeFrom || !rangeTo}
          className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40">
          نمایش آمار
        </button>
      </div>

      {rangeConfirmed && rangeFrom && rangeTo && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(99,102,241,0.25)", backgroundColor: "rgba(99,102,241,0.08)" }}>
              <div className="text-xl font-bold" style={{ color: "#818cf8" }}>{formatDuration(totalTracked)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>کل زمان</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(52,211,153,0.25)", backgroundColor: "rgba(52,211,153,0.08)" }}>
              <div className="text-xl font-bold" style={{ color: "#34d399" }}>{toPersianDigits(filteredTasks.length)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>تسک</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(251,191,36,0.25)", backgroundColor: "rgba(251,191,36,0.08)" }}>
              <div className="text-xl font-bold" style={{ color: "#fbbf24" }}>{formatDuration(totalTracked - totalTimelineSeconds > 0 ? totalTracked - totalTimelineSeconds : 0)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>تایمر تسک‌ها</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ border: "1px solid rgba(139,92,246,0.25)", backgroundColor: "rgba(139,92,246,0.08)" }}>
              <div className="text-xl font-bold" style={{ color: "#a78bfa" }}>{formatDuration(totalTimelineSeconds)}</div>
              <div className="text-xs mt-1" style={{ color: fgMuted }}>تایم‌لاین دستی</div>
            </div>
          </div>
          {totalTimelineSeconds > 0 && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: "#818cf8" }}>
              📊 آمار شامل <strong>{formatDuration(totalTimelineSeconds)}</strong> از فعالیت‌های دستی ثبت‌شده در تایم‌لاین است.
            </div>
          )}
          {pieData.length > 0 && (
            <div className="rounded-2xl p-4 space-y-3" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
              <h3 className="text-sm font-semibold" style={{ color: fg }}>توزیع زمان</h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div style={{ width: "100%", maxWidth: 220, height: 220 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <RechartTooltip formatter={(value) => [formatDuration(Number(value))]}
                        contentStyle={{ backgroundColor: bg, border: `1px solid ${cardBorder}`, borderRadius: 12, direction: "rtl", color: fg }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {pieData.map((d) => {
                    const pct = totalTracked > 0 ? Math.round((d.value / totalTracked) * 100) : 0;
                    return (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="flex-1 text-sm" style={{ color: fg }}>{d.name}</span>
                        <span className="text-xs font-bold" style={{ color: d.color }}>{formatDuration(d.value)} ({toPersianDigits(pct)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {filteredTasks.length > 0 && (
            <div className="rounded-2xl p-4 space-y-2" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
              <h3 className="text-sm font-semibold" style={{ color: fg }}>تسک‌های این بازه</h3>
              {filteredTasks.map((t) => {
                const act = activities.find((a) => a.id === t.activity_id);
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ border: `1px solid ${act ? `${act.color}30` : cardBorder}`, backgroundColor: act ? `${act.color}08` : "transparent" }}>
                    {act && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: act.color }} />}
                    <span className="flex-1 text-sm truncate" style={{ color: fg }}>{t.title}</span>
                    {t.tags && t.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#818cf8" }}>#{tag}</span>
                    ))}
                    <span className="text-xs font-mono font-semibold" style={{ color: act ? act.color : fgMuted }}>{formatDuration(t.elapsed_seconds || 0)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {timelineEntriesInRange.length > 0 && (
            <div className="rounded-2xl p-4 space-y-2" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
              <h3 className="text-sm font-semibold" style={{ color: fg }}>فعالیت‌های دستی ثبت‌شده</h3>
              {timelineEntriesInRange.map((e) => {
                const act = activities.find((a) => a.id === e.activity_id);
                if (!act) return null;
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ border: `1px solid ${act.color}30`, backgroundColor: `${act.color}08` }}>
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: act.color }} />
                    <span className="text-xs font-semibold" style={{ color: act.color }}>{act.name}</span>
                    <span className="text-[10px]" style={{ color: fgMuted }}>{toShamsiShort(e.date)}</span>
                    <span className="text-[10px]" style={{ color: fgMuted }}>{e.from_time} – {e.to_time}</span>
                    {e.note && <span className="text-[10px] truncate flex-1" style={{ color: fgMuted }}>· {e.note}</span>}
                    <span className="text-xs font-mono font-semibold" style={{ color: act.color }}>
                      {e.duration_seconds ? formatDuration(e.duration_seconds) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {filteredTasks.length === 0 && timelineEntriesInRange.length === 0 && (
            <div className="rounded-2xl p-8 text-center text-sm" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>
              در این بازه با فیلترهای انتخابی داده‌ای یافت نشد
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── Main KanbanView ───────────────────────────────────────────────────────────
const TABS = [
  { id: "kanban", label: "کانبان", icon: List },
  { id: "timeline", label: "تایم‌لاین", icon: CalIcon },
  { id: "stats", label: "آمار", icon: BarChart3 },
];

export default function KanbanView({ tasks, activities, onMove, onTasksChange }: Props) {
  const { fgMuted, cardBg, cardBorder } = useThemeStyles();
  const [tab, setTab] = useState<"kanban" | "timeline" | "stats">("kanban");
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex gap-1 rounded-2xl p-1" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all"
            style={tab === id
              ? { backgroundColor: "#6366f1", color: "#fff", boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }
              : { color: fgMuted }}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tab === "kanban" && <KanbanTab tasks={tasks} activities={activities} onMove={onMove} />}
          {tab === "timeline" && <TimelineTab tasks={tasks} activities={activities} onTasksChange={onTasksChange} />}
          {tab === "stats" && <StatsTab tasks={tasks} activities={activities} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
