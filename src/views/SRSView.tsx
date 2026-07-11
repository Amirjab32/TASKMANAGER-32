import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Plus, Trash2, BookOpen, Settings2 } from "lucide-react";
import { StudyTopic } from "@/lib/store";
import { getGregorianToday, toShamsiShort, toPersianDigits } from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";

interface Props {
  topics: StudyTopic[];
  onAdd: (data: { title: string; description?: string; total_stages: number }) => void;
  onReview: (topic: StudyTopic) => void;
  onDelete: (id: string) => void;
}

const ALL_INTERVALS = [1, 3, 7, 14, 30, 60];
const DEFAULT_STAGES = 4;
const STAGE_OPTIONS = [
  { value: 2, label: "۲ مرحله", sub: "۱، ۳ روز" },
  { value: 3, label: "۳ مرحله", sub: "۱، ۳، ۷ روز" },
  { value: 4, label: "۴ مرحله", sub: "۱، ۳، ۷، ۱۴ روز" },
  { value: 5, label: "۵ مرحله", sub: "۱، ۳، ۷، ۱۴، ۳۰ روز" },
  { value: 6, label: "۶ مرحله", sub: "۱، ۳، ۷، ۱۴، ۳۰، ۶۰ روز" },
];

export default function SRSView({ topics, onAdd, onReview, onDelete }: Props) {
  const { fg, fgMuted, cardBg, cardBorder } = useThemeStyles();
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedStages, setSelectedStages] = useState(DEFAULT_STAGES);
  const today = getGregorianToday();
  const dueTodayTopics = topics.filter((t) => !t.next_review_date || t.next_review_date <= today);
  const futureTopics = topics.filter((t) => t.next_review_date && t.next_review_date > today);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd({ title: newTitle.trim(), description: newDesc.trim() || undefined, total_stages: selectedStages });
    setNewTitle(""); setNewDesc(""); setSelectedStages(DEFAULT_STAGES); setShowForm(false);
  };

  const getIntervals = (topic: StudyTopic) => ALL_INTERVALS.slice(0, topic.total_stages ?? DEFAULT_STAGES);
  const isCompleted = (topic: StudyTopic) => topic.review_count >= (topic.total_stages ?? DEFAULT_STAGES);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
          <span className="text-sm" style={{ color: fgMuted }}>{toPersianDigits(dueTodayTopics.length)} موضوع آماده برای مرور</span>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-600"
          style={{ boxShadow: "0 4px 14px rgba(99,102,241,0.2)" }}>
          <Plus className="h-4 w-4" />موضوع جدید
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-3 rounded-2xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="عنوان موضوع..." autoFocus
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
            <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              placeholder="توضیحات (اختیاری)..."
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fg }} />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" style={{ color: fgMuted }} />
                <span className="text-xs font-semibold" style={{ color: fgMuted }}>تعداد مراحل مرور</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {STAGE_OPTIONS.map(({ value, label, sub }) => (
                  <button key={value} type="button" onClick={() => setSelectedStages(value)}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-right transition-all"
                    style={{ border: `1px solid ${selectedStages === value ? "#6366f1" : cardBorder}`, backgroundColor: selectedStages === value ? "rgba(99,102,241,0.12)" : "transparent", color: selectedStages === value ? "#818cf8" : fgMuted }}>
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-[11px] opacity-70">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setSelectedStages(DEFAULT_STAGES); }}
                className="rounded-xl px-3 py-2 text-xs"
                style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>لغو</button>
              <button onClick={handleAdd} disabled={!newTitle.trim()}
                className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40">افزودن</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
          <h2 className="text-sm font-semibold" style={{ color: fg }}>آماده برای مرور امروز ({toPersianDigits(dueTodayTopics.length)})</h2>
        </div>
        {dueTodayTopics.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-6 text-center text-sm"
            style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg, color: fgMuted }}>
            مروری برای امروز نداری 🎉
          </motion.div>
        ) : (
          <AnimatePresence>
            {dueTodayTopics.map((topic) => {
              const intervals = getIntervals(topic);
              const completed = isCompleted(topic);
              const currentStageIdx = Math.min(topic.review_count, intervals.length - 1);
              return (
                <motion.div key={topic.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}
                  className="rounded-xl p-4"
                  style={{ border: `1px solid ${completed ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.2)"}`, backgroundColor: completed ? "rgba(16,185,129,0.05)" : "rgba(244,63,94,0.05)" }}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: completed ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)" }}>
                      <Brain className="h-5 w-5" style={{ color: completed ? "#34d399" : "#f87171" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium" style={{ color: fg }}>{topic.title}</p>
                      {topic.description && <p className="mt-0.5 text-xs" style={{ color: fgMuted }}>{topic.description}</p>}
                      <div className="mt-2 flex items-center gap-1.5">
                        {intervals.map((interval, i) => (
                          <div key={i} className="flex h-5 items-center gap-0.5 rounded-md px-1.5 text-[10px]"
                            style={{ backgroundColor: i < topic.review_count ? "rgba(99,102,241,0.2)" : i === currentStageIdx && !completed ? "rgba(244,63,94,0.2)" : "rgba(128,128,128,0.1)", color: i < topic.review_count ? "#818cf8" : i === currentStageIdx && !completed ? "#f87171" : fgMuted }}>
                            {toPersianDigits(interval)}ر
                          </div>
                        ))}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs" style={{ color: fgMuted }}>
                        <span>{completed ? "✅ تمام مراحل کامل شد" : `مرحله ${toPersianDigits(topic.review_count + 1)} از ${toPersianDigits(intervals.length)}`}</span>
                        {!completed && <><span>·</span><span>مرور بعدی: {topic.next_review_date ? toShamsiShort(topic.next_review_date) : "امروز"}</span></>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!completed && (
                        <button onClick={() => onReview(topic)}
                          className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600">
                          <BookOpen className="h-3.5 w-3.5" />مرور کردم
                        </button>
                      )}
                      <button onClick={() => onDelete(topic.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-500/15" style={{ color: fgMuted }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </section>
      {futureTopics.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            <h2 className="text-sm font-semibold" style={{ color: fg }}>آینده ({toPersianDigits(futureTopics.length)})</h2>
          </div>
          <AnimatePresence>
            {futureTopics.map((topic) => {
              const intervals = getIntervals(topic);
              return (
                <motion.div key={topic.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}
                  className="rounded-xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(99,102,241,0.15)" }}>
                      <Brain className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium" style={{ color: fg }}>{topic.title}</p>
                      {topic.description && <p className="mt-0.5 text-xs" style={{ color: fgMuted }}>{topic.description}</p>}
                      <div className="mt-2 flex items-center gap-1.5">
                        {intervals.map((interval, i) => (
                          <div key={i} className="flex h-5 items-center gap-0.5 rounded-md px-1.5 text-[10px]"
                            style={{ backgroundColor: i < topic.review_count ? "rgba(99,102,241,0.2)" : "rgba(128,128,128,0.1)", color: i < topic.review_count ? "#818cf8" : fgMuted }}>
                            {toPersianDigits(interval)}ر
                          </div>
                        ))}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs" style={{ color: fgMuted }}>
                        <span>مرور بعدی: {topic.next_review_date ? toShamsiShort(topic.next_review_date) : "—"}</span>
                        <span>·</span><span>مرحله {toPersianDigits(topic.review_count)} از {toPersianDigits(intervals.length)}</span>
                        <span>·</span><span>هر {toPersianDigits(topic.current_interval)} روز</span>
                      </div>
                    </div>
                    <button onClick={() => onDelete(topic.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-500/15" style={{ color: fgMuted }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = fgMuted; }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      )}
      {topics.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 rounded-xl p-10 text-center"
          style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
          <Brain className="mx-auto h-10 w-10" style={{ color: `${fgMuted}55` }} />
          <p className="text-sm" style={{ color: fgMuted }}>هنوز موضوعی اضافه نکردی</p>
        </motion.div>
      )}
      <div className="rounded-xl p-4" style={{ border: `1px solid ${cardBorder}`, backgroundColor: cardBg }}>
        <h3 className="mb-2 text-xs font-semibold" style={{ color: fgMuted }}>فاصله‌های مرور موجود</h3>
        <div className="flex flex-wrap gap-2">
          {ALL_INTERVALS.map((interval, i) => (
            <span key={interval} className="rounded-lg px-3 py-1 text-xs"
              style={{ backgroundColor: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
              مرحله {toPersianDigits(i + 1)}: {toPersianDigits(interval)} روز
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
