import { cn } from "@/lib/utils";

interface FogattoLogoProps {
  variant?: "horizontal" | "stacked" | "mark";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Override the wordmark color (default: bone/foreground) */
  wordmarkColor?: string;
}

const FLAME_PATH = "M50 5 C 62 33, 86 44, 86 76 C 86 100, 70 115, 50 115 C 30 115, 14 100, 14 76 C 14 53, 38 48, 45 25 C 47 18, 49 12, 50 5 Z";
const FLAME_INNER = "M50 52 C 57 65, 67 71, 67 85 C 67 98, 59 106, 50 106 C 41 106, 33 98, 33 85 C 33 74, 45 70, 47 61 C 48 58, 49 55, 50 52 Z";

const sizeMap = {
  sm:  { mark: 20, wordmark: 24, gap: 8 },
  md:  { mark: 28, wordmark: 34, gap: 12 },
  lg:  { mark: 40, wordmark: 48, gap: 16 },
  xl:  { mark: 56, wordmark: 66, gap: 20 },
};

export function FogattoFlame({
  width = 40,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  const h = height ?? Math.round(width * 1.2);
  return (
    <svg
      viewBox="0 0 100 120"
      width={width}
      height={h}
      className={className}
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 ${Math.round(width * 0.2)}px ${Math.round(width * 0.5)}px rgba(228,90,40,.3))` }}
    >
      <defs>
        <linearGradient id="fogatto-flame-grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F6C268" />
          <stop offset=".5" stopColor="#E45A28" />
          <stop offset="1" stopColor="#C2461C" />
        </linearGradient>
      </defs>
      <path d={FLAME_PATH} fill="url(#fogatto-flame-grad)" />
      <path d={FLAME_INNER} fill="#14100D" opacity="0.38" />
    </svg>
  );
}

export function FogattoLogo({
  variant = "horizontal",
  size = "md",
  className,
  wordmarkColor,
}: FogattoLogoProps) {
  const { mark, wordmark, gap } = sizeMap[size];
  const flameH = Math.round(mark * 1.2);

  const wordmarkStyle: React.CSSProperties = {
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
    fontWeight: 800,
    fontSize: wordmark,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    color: wordmarkColor ?? "var(--color-foreground, #F7F2EA)",
  };

  if (variant === "mark") {
    return <FogattoFlame width={mark} height={flameH} className={className} />;
  }

  if (variant === "stacked") {
    return (
      <div
        className={cn("flex flex-col items-center", className)}
        style={{ gap }}
      >
        <FogattoFlame width={mark} height={flameH} />
        <span style={wordmarkStyle}>Fogatto</span>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center", className)}
      style={{ gap }}
    >
      <FogattoFlame width={mark} height={flameH} />
      <span style={wordmarkStyle}>Fogatto</span>
    </div>
  );
}
