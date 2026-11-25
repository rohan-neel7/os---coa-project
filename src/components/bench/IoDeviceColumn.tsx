import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, Radio, Zap } from 'lucide-react';
import { DEVICE_ACCENTS } from '../../engine/constants';
import type { DeviceId, SimState } from '../../engine/types';
import {
  KeyboardIllustration,
  MouseIllustration,
  PrinterIllustration,
  TimerIllustration,
} from '../hardware/HardwareArt';

interface IoDeviceColumnProps {
  state: SimState;
  liveKeysEnabled: boolean;
  onToggleLiveKeys: () => void;
  onTriggerDevice: (deviceId: DeviceId, customPayload?: string) => void;
  onTriggerStorm: () => void;
  onTogglePeriodicTimer: () => void;
  onToggleAutoTraffic: () => void;
  registerNodeRef: (id: DeviceId) => (el: HTMLDivElement | null) => void;
}

const KEYCAPS: { label: string; payload: string }[] = [
  { label: 'A', payload: "SCAN 0x1E 'A'" },
  { label: 'S', payload: "SCAN 0x1F 'S'" },
  { label: 'D', payload: "SCAN 0x20 'D'" },
  { label: 'ENT', payload: "SCAN 0x1C 'RET'" },
];

export const IoDeviceColumn: React.FC<IoDeviceColumnProps> = ({
  state,
  liveKeysEnabled,
  onToggleLiveKeys,
  onTriggerDevice,
  onTriggerStorm,
  onTogglePeriodicTimer,
  onToggleAutoTraffic,
  registerNodeRef,
}) => {
  const [ripple, setRipple] = useState<{ id: number; xPct: number; yPct: number } | null>(null);

  const kbd = state.devices.keyboard;
  const mse = state.devices.mouse;
  const prn = state.devices.printer;
  const tmr = state.devices.timer;

  const timerProgress = state.periodicTimer
    ? ((state.tick % state.timerPeriod) / state.timerPeriod) * 100
    : 0;

  const handleRadarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(12, Math.min(88, ((e.clientY - rect.top) / rect.height) * 100));
    const dx = Math.round(((xPct - 50) / 50) * 24);
    const dy = Math.round(((50 - yPct) / 50) * 24);
    const dxStr = dx >= 0 ? `+${dx}` : `${dx}`;
    const dyStr = dy >= 0 ? `+${dy}` : `${dy}`;
    setRipple({ id: Date.now(), xPct, yPct });
    onTriggerDevice('mouse', `ΔX:${dxStr} ΔY:${dyStr} [CLK]`);
  };

  const getModuleTone = (id: DeviceId) => {
    const dev = state.devices[id];
    if (dev.inService) {
      return 'border-rose-500/80 bg-rose-500/10 glow-irq';
    }
    if (dev.pending) {
      return 'border-amber-400/75 bg-amber-500/10 glow-ctrl';
    }
    return 'border-[#1E293B] bg-[#0B101A]/95';
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Column Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#1E293B] bg-[#0D131F]/90 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#F59E0B]" />
          <h2 className="font-[var(--font-display)] text-xs font-bold uppercase tracking-widest text-slate-100">
            I/O Devices
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={onTriggerStorm}
            title="Simultaneously fire Printer (IRQ7), Mouse (IRQ3), and Keyboard (IRQ1)"
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200 transition hover:bg-amber-500/25"
          >
            <Flame className="h-3 w-3" />
            IRQ STORM
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={onToggleAutoTraffic}
            className={`inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold transition ${
              state.autoTraffic
                ? 'border-rose-500/70 bg-rose-500/20 text-rose-200 glow-irq'
                : 'border-[#1E293B] bg-[#080B10] text-slate-400 hover:border-slate-600 hover:text-slate-200'
            }`}
          >
            <Radio className={`h-3 w-3 ${state.autoTraffic ? 'animate-pulse' : ''}`} />
            BURST: {state.autoTraffic ? 'ON' : 'OFF'}
          </motion.button>
        </div>
      </div>

      {/* 1. Keyboard (IRQ1) */}
      <div
        ref={registerNodeRef('keyboard')}
        className={`hw-card rounded-md border p-2.5 transition-all ${getModuleTone('keyboard')}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <KeyboardIllustration active={kbd.inService} pending={kbd.pending} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-100">Keyboard</span>
                <span
                  className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold"
                  style={{
                    color: DEVICE_ACCENTS.keyboard.color,
                    borderColor: 'rgba(245,158,11,0.45)',
                    backgroundColor: 'rgba(245,158,11,0.1)',
                  }}
                >
                  IRQ1
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-amber-200/85">
                {kbd.pending && kbd.pendingPayload
                  ? kbd.pendingPayload
                  : kbd.inService
                    ? 'SERVICING SCAN CODE'
                    : 'PS/2 Scan-Code Buffer'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleLiveKeys}
            title="Capture physical keyboard typing to fire live IRQ1 scan codes"
            className={`cursor-pointer rounded border px-1.5 py-1 font-mono text-[9px] font-bold transition ${
              liveKeysEnabled
                ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                : 'border-slate-700 bg-[#070A0F] text-slate-400 hover:text-slate-200'
            }`}
          >
            LIVE {liveKeysEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {KEYCAPS.map((k) => (
            <motion.button
              key={k.label}
              type="button"
              whileTap={{ y: 2, scale: 0.93 }}
              onClick={() => onTriggerDevice('keyboard', k.payload)}
              className="cursor-pointer rounded border border-amber-500/35 border-b-2 border-b-amber-500/75 bg-[#121927] py-1 font-mono text-[10px] font-bold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/15"
            >
              {k.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* 2. Mouse HID (IRQ3) */}
      <div
        ref={registerNodeRef('mouse')}
        className={`hw-card rounded-md border p-2.5 transition-all ${getModuleTone('mouse')}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MouseIllustration active={mse.inService} pending={mse.pending} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-100">Mouse HID</span>
                <span
                  className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold"
                  style={{
                    color: DEVICE_ACCENTS.mouse.color,
                    borderColor: 'rgba(56,189,248,0.45)',
                    backgroundColor: 'rgba(56,189,248,0.1)',
                  }}
                >
                  IRQ3
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-sky-200/85">
                {mse.pending && mse.pendingPayload
                  ? mse.pendingPayload
                  : mse.inService
                    ? 'SERVICING HID PACKET'
                    : 'Optical Sensor · ΔX/ΔY'}
              </div>
            </div>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Mouse XY optical radar pad — click to trigger IRQ3"
          onClick={handleRadarClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onTriggerDevice('mouse', 'ΔX:+10 ΔY:+4 [CLK]');
          }}
          className="relative mt-2 h-9 cursor-crosshair overflow-hidden rounded border border-sky-500/35 bg-[#05080E] transition hover:border-sky-400/75"
        >
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-sky-500/20" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-sky-500/20" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[9px] tracking-wider text-sky-300/70">
            CLICK XY PAD TO SEND HID PACKET
          </span>

          <AnimatePresence>
            {ripple && (
              <motion.span
                key={ripple.id}
                initial={{ scale: 0.2, opacity: 0.95 }}
                animate={{ scale: 2.3, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45 }}
                style={{ left: `${ripple.xPct}%`, top: `${ripple.yPct}%` }}
                className="pointer-events-none absolute -mt-2.5 -ml-2.5 h-5 w-5 rounded-full border border-sky-300 bg-sky-400/25"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 3. Printer / DMA (IRQ7) */}
      <div
        ref={registerNodeRef('printer')}
        className={`hw-card rounded-md border p-2.5 transition-all ${getModuleTone('printer')}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <PrinterIllustration
              active={prn.inService}
              pending={prn.pending}
              jobText={prn.pendingPayload ?? 'DMA 4KB'}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-100">Printer / DMA</span>
                <span
                  className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold"
                  style={{
                    color: DEVICE_ACCENTS.printer.color,
                    borderColor: 'rgba(45,212,191,0.45)',
                    backgroundColor: 'rgba(45,212,191,0.1)',
                  }}
                >
                  IRQ7
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-teal-200/85">
                {prn.pending && prn.pendingPayload
                  ? prn.pendingPayload
                  : prn.inService
                    ? 'DMA COMPLETION ISR'
                    : 'DMA Spool Buffer Ready'}
              </div>
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => onTriggerDevice('printer')}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border border-teal-400/50 bg-teal-500/15 px-2.5 py-1.5 font-mono text-[10px] font-bold text-teal-200 transition hover:bg-teal-500/25"
          >
            <Zap className="h-3 w-3" />
            DMA DONE
          </motion.button>
        </div>

        <div className="mt-2 grid grid-cols-8 gap-1">
          {Array.from({ length: 8 }).map((_, idx) => {
            const active = prn.inService || prn.pending ? true : idx < (state.tick % 8) + 1;
            return (
              <div
                key={idx}
                className={`h-1 rounded-xs transition-colors ${
                  prn.inService
                    ? 'bg-rose-400'
                    : prn.pending
                      ? 'bg-amber-400'
                      : active
                        ? 'bg-teal-400/65'
                        : 'bg-slate-800'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* 4. System Timer / PIT (IRQ0) */}
      <div
        ref={registerNodeRef('timer')}
        className={`hw-card rounded-md border p-2.5 transition-all ${getModuleTone('timer')}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <TimerIllustration active={tmr.inService} pending={tmr.pending} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-100">PIT Timer</span>
                <span
                  className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold"
                  style={{
                    color: DEVICE_ACCENTS.timer.color,
                    borderColor: 'rgba(16,185,129,0.45)',
                    backgroundColor: 'rgba(16,185,129,0.1)',
                  }}
                >
                  IRQ0
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-emerald-200/85">
                {tmr.pending && tmr.pendingPayload
                  ? tmr.pendingPayload
                  : state.periodicTimer
                    ? `Periodic · Every ${state.timerPeriod} ticks`
                    : `PIT_TICK #${tmr.totalTriggered + 1}`}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => onTriggerDevice('timer')}
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-emerald-400/50 bg-emerald-500/15 px-2 py-1 font-mono text-[10px] font-bold text-emerald-200 transition hover:bg-emerald-500/25"
            >
              <Zap className="h-3 w-3" />
              TICK
            </motion.button>
            <button
              type="button"
              onClick={onTogglePeriodicTimer}
              title="Toggle periodic timer interrupts"
              className={`cursor-pointer rounded border px-1.5 py-1 font-mono text-[10px] font-bold transition ${
                state.periodicTimer
                  ? 'border-emerald-400/75 bg-emerald-500/25 text-emerald-200'
                  : 'border-[#1E293B] bg-[#070A0F] text-slate-400 hover:text-slate-200'
              }`}
            >
              {state.periodicTimer ? 'AUTO' : 'MAN'}
            </button>
          </div>
        </div>

        <div className="mt-2 h-1 w-full overflow-hidden rounded bg-slate-800">
          <motion.div
            className={`h-full ${state.periodicTimer ? 'bg-emerald-400' : 'bg-slate-600'}`}
            animate={{ width: `${state.periodicTimer ? Math.max(8, timerProgress) : 0}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>
    </div>
  );
};
