import React from 'react';
import { CheckCircle2, Circle, Play, RotateCcw } from 'lucide-react';
import { DEVICE_ACCENTS, SPATIAL_DEVICE_ORDER } from '../engine/constants';
import type { ConceptKey, PresetId, VerifiedConcepts } from '../engine/types';

interface RequirementsChecklistProps {
  verified: VerifiedConcepts;
  onRunDemo: (presetId: PresetId) => void;
  onResetChecklist: () => void;
}

interface RequirementItem {
  key: ConceptKey;
  group: 'COA' | 'OS';
  title: string;
  detail: string;
  demoPreset: PresetId;
}

const REQUIREMENTS: RequirementItem[] = [
  {
    key: 'hardwareInterrupts',
    group: 'COA',
    title: 'Hardware Interrupts (4 Devices)',
    detail: 'KBD (IRQ1), MSE (IRQ3), PRN/DMA (IRQ7), PIT (IRQ0)',
    demoPreset: 'interrupt-storm',
  },
  {
    key: 'interruptController',
    group: 'COA',
    title: 'Interrupt Controller (PIC 8259A)',
    detail: 'IRR/ISR tracking, IMR masking, INTA & EOI handshake',
    demoPreset: 'interrupt-storm',
  },
  {
    key: 'instructionCycle',
    group: 'COA',
    title: 'Instruction Execution Cycle',
    detail: 'FETCH → DECODE → EXECUTE → INT CHECK boundary check',
    demoPreset: 'single-kbd',
  },
  {
    key: 'cpuRegistersContext',
    group: 'COA',
    title: 'CPU Registers & Stack Save/Restore',
    detail: 'Push/pop PC, FLAGS, R0–R3 & SP frame during ISR/IRET',
    demoPreset: 'single-kbd',
  },
  {
    key: 'ivtLookup',
    group: 'COA',
    title: 'Interrupt Vector Table (IVT)',
    detail: 'Map Vector ID (0x20–0x27) to target ISR address',
    demoPreset: 'single-kbd',
  },
  {
    key: 'priorityAndNesting',
    group: 'COA',
    title: 'Priorities & Nested Preemption',
    detail: 'P1–P4 arbitration + higher-priority ISR preemption',
    demoPreset: 'nested-preemption',
  },
  {
    key: 'deviceManagement',
    group: 'OS',
    title: 'Device Management',
    detail: 'Hardware event generation, scan codes, HID & DMA status',
    demoPreset: 'single-kbd',
  },
  {
    key: 'ioManagement',
    group: 'OS',
    title: 'I/O Buffer Management',
    detail: 'Device port reads queued & consumed in OS I/O buffer',
    demoPreset: 'single-kbd',
  },
  {
    key: 'interruptHandling',
    group: 'OS',
    title: 'Interrupt Service Routine (ISR)',
    detail: 'Full pause → ISR driver execution → EOI → IRET resume',
    demoPreset: 'single-kbd',
  },
  {
    key: 'processSynchronization',
    group: 'OS',
    title: 'Process Synchronization (No Busy-Wait)',
    detail: 'Process blocks on I/O, yields to Idle, wakes on IRQ7',
    demoPreset: 'os-io-wakeup',
  },
];

export const RequirementsChecklist: React.FC<RequirementsChecklistProps> = ({
  verified,
  onRunDemo,
  onResetChecklist,
}) => {
  const verifiedCount = REQUIREMENTS.filter((r) => verified.concepts[r.key] !== null).length;
  const pct = Math.round((verifiedCount / REQUIREMENTS.length) * 100);

  const coaItems = REQUIREMENTS.filter((r) => r.group === 'COA');
  const osItems = REQUIREMENTS.filter((r) => r.group === 'OS');

  const renderItem = (item: RequirementItem) => {
    const tickVerified = verified.concepts[item.key];
    const done = tickVerified !== null;

    return (
      <div
        key={item.key}
        className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 transition-colors ${
          done
            ? 'border-emerald-500/45 bg-emerald-500/8'
            : 'border-[#1E293B] bg-[#070A0F]/85'
        }`}
      >
        <div className="flex min-w-0 items-start gap-2">
          {done ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          ) : (
            <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[11px] font-semibold ${done ? 'text-emerald-100' : 'text-slate-200'}`}>
                {item.title}
              </span>
              {item.key === 'hardwareInterrupts' && (
                <span className="inline-flex items-center gap-1">
                  {SPATIAL_DEVICE_ORDER.map((d) => {
                    const hit = verified.triggeredDevices[d];
                    return (
                      <span
                        key={d}
                        title={`${d.toUpperCase()} ${hit ? 'triggered' : 'not yet triggered'}`}
                        className="h-2 w-2 rounded-full border"
                        style={{
                          backgroundColor: hit ? DEVICE_ACCENTS[d].color : 'transparent',
                          borderColor: DEVICE_ACCENTS[d].color,
                          opacity: hit ? 1 : 0.4,
                        }}
                      />
                    );
                  })}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">{item.detail}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {done ? (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-300">
              T{String(tickVerified).padStart(4, '0')}
            </span>
          ) : (
            <span className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
              PENDING
            </span>
          )}
          <button
            type="button"
            onClick={() => onRunDemo(item.demoPreset)}
            title="Load & play demonstration preset"
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-300 transition hover:bg-sky-500/20"
          >
            <Play className="h-2.5 w-2.5" />
            DEMO
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="flex flex-col rounded-md border border-[#1E293B] bg-[#0B101A] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-slate-100">
            OS + COA Live Requirements Checklist
          </h3>
          <p className="text-[10px] text-slate-400">
            Tracks demonstrated syllabus concepts across your session
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
              verifiedCount === REQUIREMENTS.length
                ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200 glow-data'
                : 'border-sky-500/40 bg-sky-500/10 text-sky-300'
            }`}
          >
            {verifiedCount} / {REQUIREMENTS.length} VERIFIED
          </span>
          <button
            type="button"
            onClick={onResetChecklist}
            title="Reset session verification checklist"
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#1E293B] bg-[#070A0F] px-2 py-0.5 font-mono text-[9px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            CLEAR
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded bg-slate-800/80">
        <div
          className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Grouped Scrollable Grid */}
      <div className="telemetry-scroll grid max-h-[250px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-sky-400">
            COA Concepts (6)
          </div>
          {coaItems.map(renderItem)}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-violet-400">
            OS Concepts (4)
          </div>
          {osItems.map(renderItem)}
        </div>
      </div>
    </section>
  );
};
