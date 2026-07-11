import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { Habit } from "@/lib/store";
import {
  getTodayJalali, jalaliToGregorian, toPersianDigits,
  getGregorianToday, addDays, daysInJalaliMonth,
} from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";
import JalaliCalendar from "@/components/shared/JalaliCalendar";

interface Props {
  habit: Habit;
  onClose: () => void;
}

function computeStreak(dates: string[]): number {
  if (!dates || dates.length === 0) return 0;
  const set = new Set(dates);
  let streak = 0;
  let cursor = getGregorianToday();
  if (!set.has(cursor)) cursor = addDays(cursor, -1);
  while (set.has(cursor)) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}

export default function HabitMonthModal({ habit, onClose }: Props) {
  const { fg, fgMuted, bg, cardBg, cardBorder } = useThemeStyles();
  const todayJalali = getTodayJalali();
  const [jy, setJy] = useState(todayJalali[0]);
  const [jm, setJm] = useState(todayJalali[1]);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const isFutureMonth = jy > todayJalali[0] || (jy === todayJalali[0] && jm > todayJalali[1]);
  const streak = computeStreak(habit.completed_dates);
  const completedSet = new Set(habit.completed_dates);
  const todayGreg = getGregorianToday();

  let doneCount = 0, notDoneCount = 0;
  const totalDaysInMonth = daysInJalaliMonth(jy, jm);
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const gregDate = jalaliToGregorian(jy, jm, d);
    if (gregDate > todayGreg) continue;
    if (completedSet.has(gregDate)) doneCount++; else notDoneCount++;
  }
  const totalPassed = doneCount + notDoneCount;
  const percentage = totalPassed > 0 ? Math.round((doneCount / totalPassed) * 100) : 0;

  const prevMonth = () => { if (jm === 1) { setJy(jy - 1); setJm(12); } else setJm(jm - 1); };
  const nextMonth = () => {
    if (isFutureMonth) return;
    if (jm === 12) { setJy(jy + 1); setJm(1); } else setJm(jm + 1);
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} dir="rtl">
        <motion.div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
        <motion.div ref={modalRef} className="relative z-10 w-full max-w-sm rounded-2xl p-5 shadow-2xl"
          style={{ backgroundColor: bg, border: `1px solid ${cardBorder}` }}
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: habit.color }} />
              <span className="font-semibold" style={{ color: fg }}>{habit.name}</span>
              {streak > 0 && (
                <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#fb923c" }}>
                  🔥 {toPersianDigits(streak)}
                </span>
              )}
            </div>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <JalaliCalendar
            jy={jy} jm={jm} onPrev={prevMonth} onNext={nextMonth} canNext={!isFutureMonth}
            todayGreg={todayGreg}
            renderDay={(day, meta) => {
              const isDone = completedSet.has(meta.gregDate);
              const isTodayCell = jy === todayJalali[0] && jm === todayJalali[1] && day === todayJalali[2];
              return (
                <span className="flex h-full w-full items-center justify-center rounded-lg text-xs font-medium"
                  style={{ backgroundColor: isDone ? habit.color : cardBg, color: isDone ? "#fff" : meta.isFuture ? `${fgMuted}33` : fgMuted, outline: isTodayCell ? "1px solid rgba(129,140,248,0.6)" : "none" }}>
                  {isDone ? <Check className="h-3 w-3" /> : toPersianDigits(day)}
                </span>
              );
            }}
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl p-2 text-center" style={{ backgroundColor: "rgba(16,185,129,0.1)" }}>
              <div className="text-lg font-bold" style={{ color: "#34d399" }}>{toPersianDigits(doneCount)}</div>
              <div className="text-xs" style={{ color: fgMuted }}>انجام شد</div>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ backgroundColor: "rgba(244,63,94,0.1)" }}>
              <div className="text-lg font-bold" style={{ color: "#f87171" }}>{toPersianDigits(isFutureMonth ? 0 : notDoneCount)}</div>
              <div className="text-xs" style={{ color: fgMuted }}>انجام نشد</div>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ backgroundColor: "rgba(99,102,241,0.1)" }}>
              <div className="text-lg font-bold" style={{ color: "#818cf8" }}>{toPersianDigits(percentage)}%</div>
              <div className="text-xs" style={{ color: fgMuted }}>درصد انجام</div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
