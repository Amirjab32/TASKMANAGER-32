import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, Columns3, Repeat, Brain, LogOut, X, ClipboardList } from "lucide-react";
import { useThemeStyles } from "@/lib/useThemeStyles";

interface Props {
  open: boolean;
  view: string;
  onViewChange: (v: string) => void;
  onClose: () => void;
}

const NAV_ITEMS = [
  { id: "tasks", label: "مدیریت تسک", icon: CheckSquare },
  { id: "kanban", label: "کانبان", icon: Columns3 },
  { id: "habits", label: "ردیاب عادت", icon: Repeat },
  { id: "srs", label: "مرور فاصله‌دار", icon: Brain },
  { id: "quiz", label: "ردیاب تست", icon: ClipboardList },
];

export default function Sidebar({ open, view, onViewChange, onClose }: Props) {
  const { sidebarBg, fg, fgMuted, cardBorder } = useThemeStyles();
  const handleSelect = (id: string) => {
    onViewChange(id);
    onClose();
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            dir="rtl"
            className="fixed right-0 top-0 z-50 flex h-full w-72 flex-col shadow-2xl"
            style={{ backgroundColor: sidebarBg, borderLeft: `1px solid ${cardBorder}` }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            <div
              className="flex items-center justify-between p-4"
              style={{ borderBottom: `1px solid ${cardBorder}` }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500">
                  <CheckSquare className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold" style={{ color: fg }}>بهره‌وری</span>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                style={{ border: `1px solid ${cardBorder}`, color: fgMuted }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-4">
              {NAV_ITEMS.map(({ id, label, icon: Icon }, i) => (
                <motion.button
                  key={id}
                  onClick={() => handleSelect(id)}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i + 0.1 }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all"
                  style={
                    view === id
                      ? { backgroundColor: "#6366f1", color: "#ffffff", boxShadow: "0 4px 14px rgba(99,102,241,0.25)" }
                      : { color: fgMuted }
                  }
                  onMouseEnter={(e) => {
                    if (view !== id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.06)";
                      (e.currentTarget as HTMLElement).style.color = fg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (view !== id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                      (e.currentTarget as HTMLElement).style.color = fgMuted;
                    }
                  }}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{label}</span>
                </motion.button>
              ))}
            </nav>
            <div className="p-4" style={{ borderTop: `1px solid ${cardBorder}` }}>
              <div className="mb-3 rounded-xl p-3 text-center" style={{ backgroundColor: "rgba(99,102,241,0.1)" }}>
                <p className="text-xs" style={{ color: "#818cf8" }}>FocusFlow</p>
                <p className="text-xs" style={{ color: fgMuted }}>داده‌ها در مرورگر ذخیره می‌شوند</p>
              </div>
              <button
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors hover:bg-rose-500/10"
                style={{ color: "#f87171" }}
                onClick={() => {
                  if (confirm("آیا مطمئن هستید؟ تمام داده‌ها پاک می‌شوند.")) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
              >
                <LogOut className="h-5 w-5" />
                <span>پاک کردن داده‌ها</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
