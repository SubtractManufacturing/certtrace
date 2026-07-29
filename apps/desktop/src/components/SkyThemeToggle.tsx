import { cn, useTheme } from "@certtrace/ui";

const THEME_MS = "duration-500";

/**
 * Pill-shaped day/night theme switch: sun + cloud (light) / moon + stars (dark).
 * Visual-only control — no text labels.
 */
export function SkyThemeToggle({
  className,
  disabled,
}: {
  className?: string;
  disabled?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          toggleTheme();
        }
      }}
      className={cn(
        "group relative h-6 w-[2.8125rem] shrink-0 rounded-full border-[1.5px] p-[2px] transition-[background-color,border-color,box-shadow,opacity] ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-sky-500 dark:focus-visible:ring-offset-slate-950",
        THEME_MS,
        isDark
          ? "border-slate-400/80 bg-[#0b1220] shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]"
          : "border-sky-100/95 bg-sky-400 shadow-[inset_0_1px_2px_rgba(255,255,255,0.35)]",
        className,
      )}
    >
      {/* Inner track clips sky art; padding above keeps icons off the stroke */}
      <span className="relative block h-full w-full overflow-hidden rounded-full">
        {/* Day sky: one cloud, tucked right with breathing room from the sun */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity ease-in-out",
            THEME_MS,
            isDark ? "opacity-0" : "opacity-100",
          )}
        >
          <svg
            viewBox="0 0 20 12"
            className="absolute top-1/2 right-[2px] h-[8px] w-[12px] -translate-y-1/2 text-white"
            fill="currentColor"
          >
            <path d="M14.2 9.6H4.1c-1.7 0-3.1-1.3-3.1-2.9 0-1.5 1.1-2.7 2.6-2.9.5-1.5 1.9-2.5 3.6-2.5 1.4 0 2.7.8 3.3 2 .5-.3 1.1-.4 1.7-.4 1.9 0 3.4 1.4 3.4 3.2 0 1.9-1.6 3.5-3.4 3.5z" />
          </svg>
        </span>

        {/* Night sky: stars */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity ease-in-out",
            THEME_MS,
            isDark ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="absolute top-[3px] left-[5px] h-[5px] w-[5px] rotate-45 bg-white/95 [clip-path:polygon(50%_0,61%_35%,100%_50%,61%_65%,50%_100%,39%_65%,0_50%,39%_35%)]" />
          <span className="absolute top-[11px] left-[11px] h-[2px] w-[2px] rounded-full bg-white/80" />
          <span className="absolute top-[14px] left-[6px] h-[3px] w-[3px] rotate-45 bg-white/90 [clip-path:polygon(50%_0,61%_35%,100%_50%,61%_65%,50%_100%,39%_65%,0_50%,39%_35%)]" />
          <span className="absolute top-[5px] left-[14px] h-[1.5px] w-[1.5px] rounded-full bg-white/70" />
        </span>

        {/* Sun / moon thumb — shared 14px footprint so both read at the same size */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 left-[1px] flex h-[14px] w-[14px] items-center justify-center transition-transform ease-in-out",
            THEME_MS,
            isDark ? "-translate-y-1/2 translate-x-[18px]" : "-translate-y-1/2 translate-x-0",
          )}
        >
          {/* Sun: larger disc + short rays, matched to moon footprint */}
          <svg
            viewBox="0 0 16 16"
            className={cn(
              "absolute inset-0 h-full w-full text-amber-300 transition-opacity ease-in-out",
              THEME_MS,
              isDark ? "opacity-0" : "opacity-100",
            )}
          >
            <circle cx="8" cy="8" r="4.35" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="8" y1="0.7" x2="8" y2="2.15" />
              <line x1="8" y1="13.85" x2="8" y2="15.3" />
              <line x1="0.7" y1="8" x2="2.15" y2="8" />
              <line x1="13.85" y1="8" x2="15.3" y2="8" />
              <line x1="2.7" y1="2.7" x2="3.75" y2="3.75" />
              <line x1="12.25" y1="12.25" x2="13.3" y2="13.3" />
              <line x1="13.3" y1="2.7" x2="12.25" y2="3.75" />
              <line x1="3.75" y1="12.25" x2="2.7" y2="13.3" />
            </g>
          </svg>

          {/* Moon */}
          <span
            className={cn(
              "relative h-[14px] w-[14px] rounded-full bg-slate-100 transition-opacity ease-in-out",
              THEME_MS,
              isDark ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="absolute top-0 right-0 h-[12px] w-[12px] translate-x-[3px] -translate-y-[1px] rounded-full bg-[#0b1220]" />
          </span>
        </span>
      </span>
    </button>
  );
}
