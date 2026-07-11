import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Check, Flame } from "lucide-react";
import { Habit } from "@/lib/store";
import { getGregorianToday, addDays, toShamsiShort, toPersianDigits } from "@/lib/shamsi";
import HabitMonthModal from "@/components/habits/HabitMonthModal";
import { useThemeStyles } from "@/lib/useThemeStyles";

interface Props {
  habits: Habit[];
  onAdd: (data: { name: string; color: string }) => void;
  onToggle: (habit: Habit) => void;
  onDelete: (id: string) => void;
}

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#ef4444"];

function computeStreak(dates: string[]): number {
  if (!dates || dates.length === 0) return 0;
  const set = new Set(dates);
  let streak = 0;
  let cursor = getGregorianToday();
  if (!set.has(cursor)) cursor = addDays(cursor, -1);
  while (set.has(cursor)) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}

export default function HabitTrackerView({ habits, onAdd, onToggle, onDelete }: Props) {
  const { fg, fgMuted, cardBg, cardBorder } = useThemeStyles();
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [showForm, setShowForm] = useState(false);
  const [modalHabit, setModalHabit] = useState<Habit | null>(null);
  const today = getGregorianToday();
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)));

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAdd({ name: newName.trim(), color: selectedColor });
    setNewName(""); setSelectedColor(COLORS[0]); setShowForm(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: fgMuted }}>{toPersianDigits(habits.length)} عادت</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-600"
          style={{ boxShadow: "0 4px 14px rgba(99,102,241,0.2)" }}>
          <Plus className="h-4 w-4" />عادت جدید
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-3 rounded-2xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="نام عادت..." autoFocus
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setSelectedColor(c)}
                    className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c, transform: selectedColor === c ? "scale(1.25)" : "scale(1)", outline: selectedColor === c ? "2px solid rgba(255,255,255,0.4)" : "none", outlineOffset: "2px" }} />
                ))}
              </div>
              <div className="mr-auto flex gap-2">
                <button onClick={() => setShowForm(false)} className="rounded-xl px-3 py-2 text-xs"
                  style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>لغو</button>
                <button onClick={handleAdd} disabled={!newName.trim()}
                  className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40">افزودن</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {habits.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-10 text-center text-sm"
          style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>
          هنوز عادتی اضافه نکردی
        </motion.div>
      ) : (
        <AnimatePresence>
          {habits.map((habit) => {
            const completedSet = new Set(habit.completed_dates);
            const isToday = completedSet.has(today);
            const streak = computeStreak(habit.completed_dates);
            return (
              <motion.div key={habit.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}
                className="space-y-3 rounded-2xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                    <button onClick={() => setModalHabit(habit)}
                      className="text-sm font-semibold transition-colors hover:opacity-70" style={{ color: fg }}>
                      {habit.name}
                    </button>
                    {streak > 0 && (
                      <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                        style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#fb923c" }}>
                        <Flame className="h-3 w-3" />{toPersianDigits(streak)}
                      </span>
                    )}
                  </div>
                  <button onClick={() => onDelete(habit.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-rose-500/15" style={{ color: fgMuted }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {last7.map((dateStr) => {
                    const done = completedSet.has(dateStr);
                    return (
                      <div key={dateStr} className="flex h-8 flex-1 items-center justify-center rounded-lg"
                        style={done ? { backgroundColor: habit.color } : { backgroundColor: "rgba(128,128,128,0.08)", border: `1px solid ${cardBorder}` }}
                        title={toShamsiShort(dateStr)}>
                        {done && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => onToggle(habit)}
                  className="w-full rounded-xl py-2.5 text-sm font-medium transition-all"
                  style={isToday ? { backgroundColor: habit.color, color: "#ffffff" } : { border: `1px solid ${cardBorder}`, backgroundColor: "rgba(128,128,128,0.06)", color: fgMuted }}>
                  {isToday ? "امروز انجام شد ✓" : "علامت‌گذاری امروز"}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
      <AnimatePresence>
        {modalHabit && <HabitMonthModal habit={modalHabit} onClose={() => setModalHabit(null)} />}
      </AnimatePresence>
    </div>
  );
}
