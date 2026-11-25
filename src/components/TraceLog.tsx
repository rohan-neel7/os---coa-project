import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { LogCategory, SimState } from '../engine/types';

interface TraceLogProps {
  state: SimState;
}

const CATEGORY_COLORS: Record<LogCategory, string> = {
  CPU: 'text-slate-400 border-slate-700 bg-slate-800/70',
  IRQ: 'text-rose-300 border-rose-500/40 bg-rose-500/15',
  CTX: 'text-amber-300 border-amber-500/40 bg-amber-500/15',
  IVT: 'text-sky-300 border-sky-500/40 bg-sky-500/15',
  ISR: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15',
  OS: 'text-violet-300 border-violet-500/40 bg-violet-500/15',
};

type FilterOption = 'ALL' | 'IRQ' | 'CTX' | 'ISR' | 'OS';

export const TraceLog: React.FC<TraceLogProps> = ({ state }) => {
  const [filter, setFilter] = useState<FilterOption>('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleLogs =
    filter === 'ALL'
      ? state.logs
      : state.logs.filter((l) =>
          filter === 'CTX' ? l.category === 'CTX' || l.category === 'IVT' : l.category === filter
        );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLogs.length]);

  return (
    <section className="flex flex-col rounded-md border border-[#1E293B] bg-[#0B101A] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-slate-100">
            Execution Trace Log
          </h3>
          <p className="text-[10px] text-slate-400">
            Step-by-step micro-operation &amp; interrupt audit trail
          </p>
        </div>

        <div className="flex items-center gap-1 font-mono text-[9px]">
          {(['ALL', 'IRQ', 'CTX', 'ISR', 'OS'] as FilterOption[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setFilter(opt)}
              className={`cursor-pointer rounded border px-2 py-0.5 transition ${
                filter === opt
                  ? 'border-sky-400/70 bg-sky-500/20 text-sky-200'
                  : 'border-[#1E293B] bg-[#070A0F] text-slate-500 hover:text-slate-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="telemetry-scroll h-[250px] overflow-y-auto rounded border border-[#1E293B] bg-[#06090F] p-2.5 font-mono text-[10px] leading-relaxed"
      >
        {visibleLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-600">
            NO MATCHING TRACE EVENTS
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {visibleLogs.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.16 }}
                className="flex items-start gap-2"
              >
                <span className="shrink-0 text-slate-600">
                  #{String(entry.tick).padStart(3, '0')}
                </span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0 text-[9px] font-semibold ${CATEGORY_COLORS[entry.category]}`}
                >
                  {entry.category}
                </span>
                <span className="text-slate-200">{entry.message}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
