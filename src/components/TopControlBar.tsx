import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ChevronRight,
  Layers,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PRESETS, getPresetDefinition } from '../engine/presets';
import type { PresetId, SimState } from '../engine/types';

interface TopControlBarProps {
  state: SimState;
  isPlaying: boolean;
  speed: number;
  sfxEnabled: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onSelectPreset: (presetId: PresetId) => void;
  onToggleSfx: () => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

export const TopControlBar: React.FC<TopControlBarProps> = ({
  state,
  isPlaying,
  speed,
  sfxEnabled,
  onTogglePlay,
  onStep,
  onReset,
  onSpeedChange,
  onSelectPreset,
  onToggleSfx,
}) => {
  const preset = getPresetDefinition(state.activePresetId);
  const inIsr = state.cpu.activeIsrDevice !== null;
  const activeDevLabel = state.cpu.activeIsrDevice
    ? state.devices[state.cpu.activeIsrDevice].shortLabel
    : null;

  return (
    <header className="border-b border-[#1E293B] bg-[#0B0E14]/95 backdrop-blur-md">
      {/* Row 1: Emblem, Transport Controls, Speed Deck, Live Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        {/* Brand Emblem */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-sky-400/50 bg-sky-500/10 text-sky-400 glow-addr">
            <Activity className="h-4.5 w-4.5" />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-[var(--font-display)] text-base font-bold tracking-wider text-slate-100">
                IRQ-TRACE
              </h1>
              <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-sky-300">
                HARDWARE CONSOLE
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interrupt Handling &amp; I/O Management Simulator
            </p>
          </div>
        </div>

        {/* Tactile Transport & Speed Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onTogglePlay}
            title="Play / Pause (Space)"
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3.5 py-1.5 font-mono text-xs font-bold tracking-wide transition ${
              isPlaying
                ? 'border-amber-400/70 bg-amber-500/20 text-amber-200 glow-ctrl'
                : 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 glow-data hover:bg-emerald-500/30'
            }`}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onStep}
            title="Step Single Micro-Op (Right Arrow)"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#111622] px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 transition hover:border-sky-400/60 hover:bg-sky-500/10 hover:text-sky-200"
          >
            <StepForward className="h-3.5 w-3.5 text-sky-400" />
            STEP
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onReset}
            title="Reset Scenario (R)"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#111622] px-2.5 py-1.5 font-mono text-xs font-medium text-slate-300 transition hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            RESET
          </motion.button>

          {/* Segmented Speed Selector */}
          <div className="flex items-center gap-0.5 rounded-md border border-[#1E293B] bg-[#070A0F] p-0.5 font-mono text-[10px]">
            <span className="px-1.5 text-[9px] font-semibold tracking-wider text-slate-500">
              SPD
            </span>
            {SPEED_OPTIONS.map((opt) => {
              const active = speed === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onSpeedChange(opt)}
                  className={`relative cursor-pointer rounded px-2 py-1 font-semibold transition-colors ${
                    active ? 'text-sky-100' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="speed-pill"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      className="absolute inset-0 rounded border border-sky-400/60 bg-sky-500/25"
                    />
                  )}
                  <span className="relative z-10">{opt}x</span>
                </button>
              );
            })}
          </div>

          {/* SFX Mute/Unmute Toggle */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
            onClick={onToggleSfx}
            aria-label={sfxEnabled ? 'Mute hardware audio' : 'Enable hardware audio'}
            title={sfxEnabled ? 'Hardware Synth SFX: ON' : 'Hardware Synth SFX: OFF'}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[10px] font-semibold transition ${
              sfxEnabled
                ? 'border-violet-500/50 bg-violet-500/15 text-violet-200'
                : 'border-[#1E293B] bg-[#111622] text-slate-500 hover:text-slate-300'
            }`}
          >
            {sfxEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            SFX
          </motion.button>
        </div>

        {/* Live Telemetry Pills */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 rounded border border-[#1E293B] bg-[#111622] px-2.5 py-1">
            <span className="text-[10px] text-slate-500">TICK</span>
            <motion.span
              key={state.tick}
              initial={{ opacity: 0.65, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.14 }}
              className="font-bold text-slate-100"
            >
              {String(state.tick).padStart(4, '0')}
            </motion.span>
          </div>

          <motion.div
            animate={{
              scale: state.cpu.FLAGS.MODE === 'KERNEL' ? [1, 1.04, 1] : 1,
            }}
            transition={{ duration: 0.25 }}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 ${
              state.cpu.FLAGS.MODE === 'KERNEL'
                ? 'border-rose-500/60 bg-rose-500/15 text-rose-200 glow-irq'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <span className="text-[10px] opacity-75">MODE</span>
            <span className="font-bold">{state.cpu.FLAGS.MODE}</span>
          </motion.div>

          <motion.div
            key={state.stack.length}
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 450, damping: 24 }}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 ${
              state.stack.length >= 2
                ? 'border-amber-400/80 bg-amber-500/20 text-amber-200 glow-ctrl'
                : state.stack.length === 1
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                  : 'border-[#1E293B] bg-[#111622] text-slate-400'
            }`}
          >
            <Layers className="h-3 w-3 opacity-80" />
            <span className="font-bold">L{state.stack.length}</span>
          </motion.div>

          <div
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 ${
              inIsr
                ? 'border-rose-500/60 bg-rose-500/15 text-rose-200'
                : 'border-[#1E293B] bg-[#111622] text-sky-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isPlaying
                  ? inIsr
                    ? 'animate-pulse bg-rose-400'
                    : 'animate-pulse bg-emerald-400'
                  : 'bg-slate-500'
              }`}
            />
            <span className="font-semibold">
              {state.cpu.phase}
              {activeDevLabel ? ` · ${activeDevLabel}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Interactive 4-Scenario Deck */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1E293B]/80 bg-[#080B10] px-4 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => {
            const active = state.activePresetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p.id)}
                className={`relative cursor-pointer rounded px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors ${
                  active
                    ? 'text-sky-100'
                    : 'border border-transparent text-slate-400 hover:border-slate-800 hover:bg-[#111622] hover:text-slate-200'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="preset-active-outline"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded border border-sky-400/60 bg-sky-500/15 glow-addr"
                  />
                )}
                <span className="relative z-10">{p.name}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 text-[11px] text-slate-400 xl:flex">
          <ChevronRight className="h-3 w-3 text-sky-400" />
          <span className="font-mono text-[10px] font-semibold text-sky-400">
            {preset.shortTag}
          </span>
          <span className="text-slate-600">|</span>
          <span className="max-w-[440px] truncate text-slate-400">{preset.description}</span>
        </div>
      </div>
    </header>
  );
};
