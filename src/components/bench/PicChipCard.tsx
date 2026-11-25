import React from 'react';
import { motion } from 'framer-motion';
import { Layers, Shield, ShieldOff } from 'lucide-react';
import { DEVICE_ACCENTS, DEVICE_ORDER, SPATIAL_DEVICE_ORDER } from '../../engine/constants';
import type { DeviceId, SimState } from '../../engine/types';
import { IcPinRail } from '../hardware/HardwareArt';

interface PicChipCardProps {
  state: SimState;
  onToggleMask: (deviceId: DeviceId) => void;
  onChangePriority: (deviceId: DeviceId, priority: number) => void;
  onToggleNested: () => void;
  nodeRef: (el: HTMLDivElement | null) => void;
}

export const PicChipCard: React.FC<PicChipCardProps> = ({
  state,
  onToggleMask,
  onChangePriority,
  onToggleNested,
  nodeRef,
}) => {
  const winningPendingId = (() => {
    let best: { id: DeviceId; priority: number; irq: number } | null = null;
    for (const id of DEVICE_ORDER) {
      const dev = state.devices[id];
      if (!dev.pending || dev.masked || dev.inService) continue;
      if (
        !best ||
        dev.priority < best.priority ||
        (dev.priority === best.priority && dev.irqNumber < best.irq)
      ) {
        best = { id, priority: dev.priority, irq: dev.irqNumber };
      }
    }
    return best?.id ?? null;
  })();

  const activePinIndices = SPATIAL_DEVICE_ORDER.reduce<number[]>((acc, id, idx) => {
    const dev = state.devices[id];
    if (dev.pending || dev.inService) acc.push(idx);
    return acc;
  }, []);

  const hasAnyActive = activePinIndices.length > 0;

  return (
    <div ref={nodeRef} className="relative flex flex-col">
      {/* Top IC Gull-Wing Pins */}
      <IcPinRail
        side="top"
        count={8}
        activeIndices={hasAnyActive ? [3, 4] : []}
        accentColor="#38BDF8"
      />

      <div className="flex items-stretch">
        {/* Left IC Pins (Aligned with SPATIAL_DEVICE_ORDER) */}
        <IcPinRail
          side="left"
          count={4}
          activeIndices={activePinIndices}
          accentColor="#F59E0B"
        />

        {/* 8259A IC Package Body */}
        <div className="ic-package relative flex flex-1 flex-col rounded-md border border-slate-700/80">
          {/* Pin-1 orientation notch */}
          <span
            aria-hidden="true"
            className="absolute top-2 left-2 h-1.5 w-1.5 rounded-full bg-slate-500/70"
          />

          {/* IC Silkscreen Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] px-3.5 py-2">
            <div className="pl-2">
              <div className="font-[var(--font-display)] text-xs font-bold uppercase tracking-wider text-slate-100">
                Interrupt Controller (PIC)
              </div>
              <div className="font-mono text-[9px] tracking-wider text-slate-400">
                8259A ARBITRATION · PRIORITY &amp; IMR
              </div>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={onToggleNested}
              className={`inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 font-mono text-[10px] font-bold transition ${
                state.nestedInterrupts
                  ? 'border-amber-400/75 bg-amber-500/20 text-amber-200 glow-ctrl'
                  : 'border-[#1E293B] bg-[#070A0F] text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3 w-3" />
              NESTED: {state.nestedInterrupts ? 'ON' : 'OFF'}
            </motion.button>
          </div>

          {/* 4 Spatial IRQ Pin Rows */}
          <div className="flex flex-col gap-2 p-3">
            <div className="grid grid-cols-[64px_34px_1fr_48px] items-center gap-1.5 px-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
              <span>PIN/DEV</span>
              <span className="text-center">IRR/ISR</span>
              <span className="text-center">PRIORITY</span>
              <span className="text-right">GATE</span>
            </div>

            {SPATIAL_DEVICE_ORDER.map((id) => {
              const dev = state.devices[id];
              const isWinner = winningPendingId === id;
              const accent = DEVICE_ACCENTS[id];

              return (
                <div
                  key={id}
                  className={`grid grid-cols-[64px_34px_1fr_48px] items-center gap-1.5 rounded border px-2 py-1.5 font-mono text-[10px] transition-colors ${
                    dev.inService
                      ? 'border-rose-500/75 bg-rose-500/12 glow-irq'
                      : isWinner
                        ? 'border-amber-400/75 bg-amber-500/12 glow-ctrl'
                        : dev.pending
                          ? 'border-amber-500/45 bg-amber-500/6'
                          : 'border-[#1E293B] bg-[#070A0F]/90'
                  }`}
                >
                  {/* Pin & Short Device Label */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: accent.color }}
                    />
                    <div className="leading-tight">
                      <div className="font-bold text-slate-100">IRQ{dev.irqNumber}</div>
                      <div className="text-[9px] text-slate-400">
                        {dev.shortLabel}
                        {isWinner && (
                          <span className="ml-1 font-bold text-amber-300">★</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* IRR (Pending) + ISR (In-Service) LEDs */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      title="IRR (Interrupt Request Pending)"
                      className={`h-2.5 w-2.5 rounded-full border ${
                        dev.pending
                          ? 'border-amber-200 bg-amber-400 shadow-[0_0_8px_#F59E0B]'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    />
                    <span
                      title="ISR (In-Service Active)"
                      className={`h-2.5 w-2.5 rounded-full border ${
                        dev.inService
                          ? 'border-rose-200 bg-rose-500 shadow-[0_0_8px_#F43F5E]'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    />
                  </div>

                  {/* Segmented Priority Buttons (P1..P4) */}
                  <div
                    role="group"
                    aria-label={`${dev.shortLabel} priority`}
                    className="grid grid-cols-4 gap-0.5 rounded border border-[#1E293B] bg-[#05080D] p-0.5"
                  >
                    {[1, 2, 3, 4].map((p) => {
                      const active = dev.priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onChangePriority(id, p)}
                          title={`Priority P${p} (${p === 1 ? 'Highest' : p === 4 ? 'Lowest' : 'Medium'})`}
                          className={`cursor-pointer rounded-xs py-0.5 text-[9px] font-bold transition ${
                            active
                              ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/70'
                              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        >
                          P{p}
                        </button>
                      );
                    })}
                  </div>

                  {/* Mask / Enable Gate */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => onToggleMask(id)}
                    className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded border px-1.5 py-1 text-[9px] font-bold transition ${
                      dev.masked
                        ? 'border-slate-700 bg-slate-800/80 text-slate-400 hover:text-slate-200'
                        : 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                    }`}
                  >
                    {dev.masked ? (
                      <>
                        <ShieldOff className="h-2.5 w-2.5" />
                        MSK
                      </>
                    ) : (
                      <>
                        <Shield className="h-2.5 w-2.5" />
                        EN
                      </>
                    )}
                  </motion.button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right IC Pins (To CPU INTR / INTA / EOI) */}
        <IcPinRail
          side="right"
          count={4}
          activeIndices={
            state.cpu.phase === 'INT_ACK' || state.cpu.activeIsrDevice
              ? [0, 1, 2]
              : []
          }
          accentColor="#F43F5E"
        />
      </div>

      {/* Bottom IC Pins */}
      <IcPinRail side="bottom" count={8} />
    </div>
  );
};
