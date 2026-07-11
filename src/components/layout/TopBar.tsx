import HamburgerButton from "./HamburgerButton";
import ThemeToggle from "./ThemeToggle";
import { todayShamsi, todayShamsiShort, todayGregorianFormatted } from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";

interface Props {
  view: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
}

const VIEW_TITLES: Record<string, string> = {
  tasks: "مدیریت تسک",
  kanban: "کانبان",
  habits: "ردیاب عادت",
  srs: "مرور فاصله‌دار",
  quiz: "ردیاب تست",
};

export default function TopBar({ view, menuOpen, onMenuToggle }: Props) {
  const { headerBg, fg, fgMuted, cardBorder } = useThemeStyles();
  return (
    <header
      className="sticky top-0 z-30 w-full backdrop-blur-xl transition-colors duration-300"
      style={{ backgroundColor: headerBg, borderBottom: `1px solid ${cardBorder}` }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <HamburgerButton open={menuOpen} onClick={onMenuToggle} />
          <div className="hidden flex-col sm:flex">
            <span className="text-sm font-bold leading-tight tracking-tight" style={{ color: fg }}>
              {todayShamsi()}
            </span>
            <span
              className="text-[11px] leading-tight"
              style={{ color: fgMuted, fontFamily: "'Segoe UI', system-ui, sans-serif", letterSpacing: "0.02em" }}
            >
              {todayGregorianFormatted()}
            </span>
          </div>
          <div className="flex flex-col sm:hidden">
            <span className="text-sm font-bold leading-tight" style={{ color: fg }}>
              {todayShamsiShort()}
            </span>
            <span
              className="text-[10px] leading-tight"
              style={{ color: fgMuted, fontFamily: "'Segoe UI', system-ui, sans-serif" }}
            >
              {todayGregorianFormatted()}
            </span>
          </div>
        </div>
        <h1 className="text-base font-semibold" style={{ color: fg }}>
          {VIEW_TITLES[view] || "بهره‌وری"}
        </h1>
        <ThemeToggle />
      </div>
    </header>
  );
}
