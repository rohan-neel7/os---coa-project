import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DEVICE_ORDER, MAX_WAVEFORM_SAMPLES } from '../engine/constants';
import type {
  DeviceId,
  SimState,
  WaveformBusActivity,
  WaveformCpuState,
  WaveformSample,
} from '../engine/types';

interface LogicAnalyzerStripProps {
  state: SimState;
}

const CPU_STATE_COLORS: Record<WaveformCpuState, { bg: string; label: string }> = {
  MAIN: { bg: '#10B981', label: 'MAIN' },
  IDLE: { bg: '#334155', label: 'IDLE' },
  CTX: { bg: '#F59E0B', label: 'CTX/IVT' },
  ISR_TIMER: { bg: '#F43F5E', label: 'ISR TMR' },
  ISR_KEYBOARD: { bg: '#FB7185', label: 'ISR KBD' },
  ISR_MOUSE: { bg: '#E879F9', label: 'ISR MSE' },
  ISR_PRINTER: { bg: '#38BDF8', label: 'ISR PRN' },
};

const BUS_COLORS: Record<WaveformBusActivity, string> = {
  NONE: '#1E293B',
  IRQ: '#F43F5E',
  CTRL: '#F59E0B',
  ADDR: '#38BDF8',
  DATA: '#10B981',
  OS: '#A78BFA',
};

const IRQ_LABELS: Record<DeviceId, string> = {
  timer: 'IRQ0 TMR',
  keyboard: 'IRQ1 KBD',
  mouse: 'IRQ3 MSE',
  printer: 'IRQ7 PRN',
};

export const LogicAnalyzerStrip: React.FC<LogicAnalyzerStripProps> = ({ state }) => {
  const [hoveredSample, setHoveredSample] = useState<WaveformSample | null>(null);
  const samples = state.waveforms;
  const slots = MAX_WAVEFORM_SAMPLES;
  const padCount = Math.max(0, slots - samples.length);

  return (
    <section
      aria-label="Logic Analyzer Strip"
      className="relative border-y border-[#1E293B] bg-[#080B10] px-4 py-2 select-none"
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 font-[var(--font-display)] text-[11px] font-semibold uppercase tracking-widest text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38BDF8]" />
            Oscilloscope · 48-Tick Capture
          </span>
          {hoveredSample ? (
            <span className="rounded border border-sky-400/50 bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-medium text-sky-200">
              T{String(hoveredSample.tick).padStart(4, '0')} · {hoveredSample.phase} ·{' '}
              {hoveredSample.summary}
              {hoveredSample.nestingDepth > 0 ? ` · DEPTH L${hoveredSample.nestingDepth}` : ''}
            </span>
          ) : (
            <span className="font-mono text-[10px] text-slate-500">
              Hover sample columns to inspect preemption edges &amp; bus cycles
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-xs bg-[#10B981]" /> MAIN
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-xs bg-[#F59E0B]" /> CTX/IVT
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-xs bg-[#F43F5E]" /> ISR
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-xs bg-[#A78BFA]" /> OS
          </span>
        </div>
      </div>

      {/* CRT Oscilloscope Viewport */}
      <div className="crt-screen relative rounded-md p-2">
        {/* Vertical Graticule Gridlines every 8 ticks */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-2 right-2 left-[112px] grid grid-cols-6"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-r border-sky-500/10 first:border-l" />
          ))}
        </div>

        <div className="relative z-10 grid grid-cols-[96px_1fr] gap-x-3 gap-y-1">
          {/* Lane 1: CPU State */}
          <div className="flex items-center font-mono text-[10px] font-semibold text-slate-400">
            CPU STATE
          </div>
          <div className="grid h-5.5 grid-cols-48 gap-[2px] rounded border border-[#1E293B]/90 bg-[#05080D]/85 p-[2px]">
            {Array.from({ length: padCount }).map((_, idx) => (
              <div key={`pad-cpu-${idx}`} className="h-full rounded-[1px] bg-slate-900/40" />
            ))}
            {samples.map((s, idx) => {
              const meta = CPU_STATE_COLORS[s.cpuState];
              const isLatest = idx === samples.length - 1;
              return (
                <motion.div
                  key={`cpu-${s.tick}`}
                  initial={{ opacity: 0.4, scaleY: 0.6 }}
                  animate={{ opacity: s.cpuState === 'IDLE' ? 0.48 : 0.94, scaleY: 1 }}
                  transition={{ duration: 0.16 }}
                  onMouseEnter={() => setHoveredSample(s)}
                  onMouseLeave={() => setHoveredSample(null)}
                  className={`relative flex h-full cursor-crosshair items-center justify-center rounded-[1px] ${
                    isLatest ? 'ring-1 ring-sky-300/90' : ''
                  }`}
                  style={{ backgroundColor: meta.bg }}
                  title={`T${s.tick}: ${s.summary}`}
                >
                  {s.nestingDepth >= 2 && (
                    <span className="font-mono text-[8px] font-bold leading-none text-white drop-shadow">
                      2
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Lane 2: Active IRQ Lines (Digital square-wave traces) */}
          <div className="flex flex-col justify-between py-0.5 font-mono text-[9px] leading-none text-slate-500">
            {DEVICE_ORDER.map((id) => (
              <span key={id} className="truncate">
                {IRQ_LABELS[id]}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-[2px] rounded border border-[#1E293B]/90 bg-[#05080D]/85 p-[2px]">
            {DEVICE_ORDER.map((id) => (
              <div key={`irq-lane-${id}`} className="grid h-3 grid-cols-48 gap-[2px]">
                {Array.from({ length: padCount }).map((_, idx) => (
                  <div
                    key={`pad-irq-${id}-${idx}`}
                    className="mt-auto h-[2px] w-full bg-slate-800/60"
                  />
                ))}
                {samples.map((s, idx) => {
                  const inSvc = s.irqInService[id];
                  const pend = s.irqPending[id];
                  const high = inSvc || pend;
                  const prev = idx > 0 ? samples[idx - 1] : null;
                  const prevHigh = prev ? prev.irqInService[id] || prev.irqPending[id] : false;
                  const risingEdge = high && !prevHigh;

                  return (
                    <div
                      key={`irq-${id}-${s.tick}`}
                      onMouseEnter={() => setHoveredSample(s)}
                      onMouseLeave={() => setHoveredSample(null)}
                      className="flex h-full cursor-crosshair items-end"
                    >
                      {inSvc ? (
                        <div
                          className={`h-full w-full rounded-t-[1px] bg-rose-500/85 shadow-[0_0_8px_rgba(244,63,94,0.65)] ${
                            risingEdge ? 'border-l border-rose-200' : ''
                          } border-t border-rose-300`}
                        />
                      ) : pend ? (
                        <div
                          className={`h-[70%] w-full rounded-t-[1px] bg-amber-400/80 ${
                            risingEdge ? 'border-l border-amber-200' : ''
                          } border-t border-amber-200`}
                        />
                      ) : (
                        <div className="h-[2px] w-full bg-slate-800/80" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Lane 3: Bus Activity */}
          <div className="flex items-center font-mono text-[10px] font-semibold text-slate-400">
            BUS ACTIVITY
          </div>
          <div className="grid h-3.5 grid-cols-48 gap-[2px] rounded border border-[#1E293B]/90 bg-[#05080D]/85 p-[2px]">
            {Array.from({ length: padCount }).map((_, idx) => (
              <div key={`pad-bus-${idx}`} className="h-full rounded-[1px] bg-slate-900/40" />
            ))}
            {samples.map((s, idx) => {
              const isLatest = idx === samples.length - 1;
              return (
                <div
                  key={`bus-${s.tick}`}
                  onMouseEnter={() => setHoveredSample(s)}
                  onMouseLeave={() => setHoveredSample(null)}
                  className={`h-full cursor-crosshair rounded-[1px] ${
                    isLatest && s.busActivity !== 'NONE' ? 'ring-1 ring-white/70' : ''
                  }`}
                  style={{
                    backgroundColor: BUS_COLORS[s.busActivity],
                    opacity: s.busActivity === 'NONE' ? 0.3 : 0.96,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
