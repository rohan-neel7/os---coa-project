import React from 'react';

interface HardwareIllustrationProps {
  active?: boolean;
  pending?: boolean;
}

export const KeyboardIllustration: React.FC<HardwareIllustrationProps> = ({ active, pending }) => {
  const accent = active ? '#F59E0B' : pending ? '#FBBF24' : '#64748B';
  return (
    <svg viewBox="0 0 96 40" className="h-8 w-[74px] shrink-0" aria-hidden="true">
      {/* Translucent smoky keypad chassis */}
      <rect
        x="2"
        y="3"
        width="92"
        height="34"
        rx="5"
        fill="#0D131F"
        stroke={accent}
        strokeWidth="1.2"
        opacity="0.95"
      />
      <rect x="6" y="7" width="84" height="26" rx="3" fill="#070B12" stroke="#1E293B" strokeWidth="0.8" />
      {/* Mini keycap row 1 */}
      {[10, 22, 34, 46, 58, 70].map((x) => (
        <rect
          key={`r1-${x}`}
          x={x}
          y="10"
          width="9"
          height="7"
          rx="1.5"
          fill="#172033"
          stroke="#334155"
          strokeWidth="0.7"
        />
      ))}
      {/* Mini keycap row 2 */}
      {[10, 22, 34, 46].map((x) => (
        <rect
          key={`r2-${x}`}
          x={x}
          y="20"
          width="9"
          height="7"
          rx="1.5"
          fill="#172033"
          stroke="#334155"
          strokeWidth="0.7"
        />
      ))}
      {/* Space / Enter accent key */}
      <rect
        x="58"
        y="20"
        width="21"
        height="7"
        rx="1.5"
        fill={active || pending ? 'rgba(245,158,11,0.22)' : '#1E293B'}
        stroke={accent}
        strokeWidth="0.8"
      />
      {/* Status LEDs (NUM / CAP / IRQ) */}
      <circle cx="84" cy="12" r="1.4" fill="#10B981" />
      <circle cx="84" cy="18" r="1.4" fill={active || pending ? '#F59E0B' : '#334155'} />
      <circle cx="84" cy="24" r="1.4" fill={active ? '#F43F5E' : '#334155'} />
    </svg>
  );
};

export const MouseIllustration: React.FC<HardwareIllustrationProps> = ({ active, pending }) => {
  const glow = active || pending ? '#38BDF8' : '#475569';
  return (
    <svg viewBox="0 0 96 42" className="h-8 w-[74px] shrink-0" aria-hidden="true">
      {/* PCB carrier under translucent shell */}
      <rect x="6" y="4" width="84" height="34" rx="14" fill="#0B111C" stroke={glow} strokeWidth="1.2" />
      {/* Internal PCB traces */}
      <path d="M 18 21 L 34 21 L 42 15" fill="none" stroke="#1E3A5F" strokeWidth="1" />
      <path d="M 18 25 L 36 25 L 44 28" fill="none" stroke="#1E3A5F" strokeWidth="1" />
      {/* Glowing optical sensor lens */}
      <circle cx="38" cy="21" r="8.5" fill="rgba(56,189,248,0.14)" stroke={glow} strokeWidth="1" />
      <circle cx="38" cy="21" r="4" fill={active || pending ? '#38BDF8' : '#0EA5E9'} opacity="0.85" />
      <circle cx="38" cy="21" r="1.6" fill="#FFFFFF" />
      {/* Scroll wheel & LMB/RMB split */}
      <line x1="60" y1="6" x2="60" y2="36" stroke="#1E293B" strokeWidth="1" />
      <rect x="65" y="16" width="12" height="10" rx="4" fill="#172234" stroke={glow} strokeWidth="1" />
      <line x1="68" y1="21" x2="74" y2="21" stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};

export const PrinterIllustration: React.FC<
  HardwareIllustrationProps & { jobText?: string }
> = ({ active, pending, jobText = 'DMA 4KB' }) => {
  const accent = active ? '#2DD4BF' : pending ? '#FBBF24' : '#475569';
  return (
    <svg viewBox="0 0 96 44" className="h-9 w-[74px] shrink-0" aria-hidden="true">
      {/* Emerging paper slip */}
      <rect
        x="24"
        y="2"
        width="48"
        height="18"
        rx="1.5"
        fill="#CBD5E1"
        stroke="#64748B"
        strokeWidth="0.8"
      />
      <line x1="29" y1="6" x2="64" y2="6" stroke="#475569" strokeWidth="1" />
      <line x1="29" y1="10" x2="58" y2="10" stroke="#64748B" strokeWidth="1" />
      <text
        x="48"
        y="15.5"
        textAnchor="middle"
        fill="#0F172A"
        fontSize="5"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="700"
      >
        {jobText.slice(0, 9)}
      </text>

      {/* Translucent printer/DMA body */}
      <rect x="6" y="15" width="84" height="25" rx="4" fill="#0C1320" stroke={accent} strokeWidth="1.2" />
      <rect x="14" y="20" width="68" height="7" rx="1.5" fill="#060A11" stroke="#1E293B" strokeWidth="0.8" />
      {/* Platen roller */}
      <rect x="18" y="22" width="60" height="3" rx="1.5" fill="#334155" />
      {/* Status LEDs */}
      <circle cx="16" cy="33" r="1.8" fill="#10B981" />
      <circle cx="24" cy="33" r="1.8" fill={active || pending ? '#2DD4BF' : '#334155'} />
      <rect x="62" y="31" width="18" height="4" rx="1" fill="#172033" />
    </svg>
  );
};

export const TimerIllustration: React.FC<HardwareIllustrationProps> = ({ active, pending }) => {
  const accent = active || pending ? '#10B981' : '#34D399';
  return (
    <svg viewBox="0 0 96 42" className="h-8 w-[74px] shrink-0" aria-hidden="true">
      {/* Brushed metallic quartz crystal oscillator canister */}
      <defs>
        <linearGradient id="xtal-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>
      <rect x="14" y="4" width="68" height="20" rx="5" fill="url(#xtal-metal)" stroke="#CBD5E1" strokeWidth="0.9" />
      <rect x="17" y="6.5" width="62" height="15" rx="3.5" fill="#0F172A" opacity="0.85" />
      <text
        x="48"
        y="16"
        textAnchor="middle"
        fill="#E2E8F0"
        fontSize="6.5"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="700"
      >
        PIT · 1.19MHz
      </text>
      {/* Oscillator pins */}
      <line x1="28" y1="24" x2="28" y2="29" stroke="#94A3B8" strokeWidth="1.6" />
      <line x1="48" y1="24" x2="48" y2="29" stroke="#94A3B8" strokeWidth="1.6" />
      <line x1="68" y1="24" x2="68" y2="29" stroke="#94A3B8" strokeWidth="1.6" />
      {/* Phosphor emerald clock waveform */}
      <path
        d="M 8 36 Q 16 28 24 36 T 40 36 T 56 36 T 72 36 T 88 36"
        fill="none"
        stroke={accent}
        strokeWidth={active || pending ? '1.8' : '1.3'}
        opacity={active || pending ? 1 : 0.7}
      />
    </svg>
  );
};

interface IcPinRailProps {
  side: 'left' | 'right' | 'top' | 'bottom';
  count: number;
  activeIndices?: number[];
  accentColor?: string;
  gold?: boolean;
}

export const IcPinRail: React.FC<IcPinRailProps> = ({
  side,
  count,
  activeIndices = [],
  accentColor = '#F59E0B',
  gold = false,
}) => {
  const isVertical = side === 'left' || side === 'right';
  const baseMetal = gold ? 'bg-amber-300/75 border-amber-200/60' : 'bg-slate-400/70 border-slate-200/50';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none flex ${
        isVertical ? 'flex-col justify-around py-3' : 'flex-row justify-around px-4'
      }`}
    >
      {Array.from({ length: count }).map((_, idx) => {
        const isActive = activeIndices.includes(idx);
        return (
          <span
            key={idx}
            style={
              isActive
                ? {
                    backgroundColor: accentColor,
                    boxShadow: `0 0 8px ${accentColor}`,
                    borderColor: '#FFFFFF',
                  }
                : undefined
            }
            className={`block border transition-all ${
              isVertical ? 'h-1.5 w-2.5' : 'h-2.5 w-1.5'
            } ${
              side === 'left'
                ? 'rounded-l-[2px]'
                : side === 'right'
                  ? 'rounded-r-[2px]'
                  : side === 'top'
                    ? 'rounded-t-[2px]'
                    : 'rounded-b-[2px]'
            } ${isActive ? '' : baseMetal}`}
          />
        );
      })}
    </div>
  );
};
