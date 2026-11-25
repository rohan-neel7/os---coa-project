import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogicAnalyzerStrip } from './components/LogicAnalyzerStrip';
import { MotherboardCanvas } from './components/MotherboardCanvas';
import { RequirementsChecklist } from './components/RequirementsChecklist';
import { TopControlBar } from './components/TopControlBar';
import { TraceLog } from './components/TraceLog';
import { DEVICE_ORDER } from './engine/constants';
import {
  createEmptyVerified,
  createInitialState,
  raiseDeviceIrq,
  setDevicePriority,
  stepMicroOp,
  toggleAutoTraffic,
  toggleDeviceMask,
  toggleNestedInterrupts,
  togglePeriodicTimer,
  triggerIrqStorm,
  triggerProcessIoBlock,
} from './engine/simulator';
import type { ConceptKey, DeviceId, PresetId, SimState, VerifiedConcepts } from './engine/types';
import { hwSound } from './utils/sound';

const SPEED_INTERVAL_MS: Record<number, number> = {
  0.25: 2000,
  0.5: 1100,
  1: 600,
  2: 280,
  4: 130,
};

function keyToScanCode(key: string): string | null {
  if (key === 'Enter') return "SCAN 0x1C 'RET'";
  if (key.length === 1 && /^[a-zA-Z0-9]$/.test(key)) {
    const upper = key.toUpperCase();
    const code = (0x1e + (upper.charCodeAt(0) % 26)).toString(16).toUpperCase().padStart(2, '0');
    return `SCAN 0x${code} '${upper}'`;
  }
  return null;
}

function mergeVerified(session: VerifiedConcepts, latest: VerifiedConcepts): VerifiedConcepts {
  let changed = false;
  const nextConcepts = { ...session.concepts };
  const nextDevices = { ...session.triggeredDevices };

  for (const key of Object.keys(nextConcepts) as ConceptKey[]) {
    if (nextConcepts[key] === null && latest.concepts[key] !== null) {
      nextConcepts[key] = latest.concepts[key];
      changed = true;
    }
  }
  for (const dev of DEVICE_ORDER) {
    if (!nextDevices[dev] && latest.triggeredDevices[dev]) {
      nextDevices[dev] = true;
      changed = true;
    }
  }

  return changed ? { concepts: nextConcepts, triggeredDevices: nextDevices } : session;
}

export const App: React.FC = () => {
  const [simState, setSimState] = useState<SimState>(() => createInitialState('single-kbd'));
  const [sessionVerified, setSessionVerified] = useState<VerifiedConcepts>(() => createEmptyVerified());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [liveKeysEnabled, setLiveKeysEnabled] = useState(false);
  const prevStateRef = useRef<SimState>(simState);

  const handleStep = useCallback(() => {
    setSimState((prev) => stepMicroOp(prev));
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setSimState((prev) => createInitialState(prev.activePresetId));
  }, []);

  const handleSelectPreset = useCallback((presetId: PresetId) => {
    setIsPlaying(false);
    setSimState(createInitialState(presetId));
  }, []);

  const handleRunDemo = useCallback((presetId: PresetId) => {
    setSimState(createInitialState(presetId));
    setIsPlaying(true);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleToggleSfx = useCallback(() => {
    setSfxEnabled((prev) => {
      const next = !prev;
      hwSound.enabled = next;
      return next;
    });
  }, []);

  // Merge verified concepts & trigger crisp hardware sound cues on state transitions
  useEffect(() => {
    const prev = prevStateRef.current;
    const curr = simState;
    prevStateRef.current = curr;

    setSessionVerified((s) => mergeVerified(s, curr.verified));

    if (!sfxEnabled) return;

    if (curr.tick > prev.tick) {
      const hasPreempt =
        (curr.stack.length > prev.stack.length && curr.stack.length >= 2) ||
        curr.logs.some((l) => l.tick === curr.tick && l.message.includes('NESTED PREEMPTION'));
      const wokeProcess = curr.processes.some((cp) => {
        const pp = prev.processes.find((p) => p.pid === cp.pid);
        return pp?.state === 'BLOCKED' && cp.state !== 'BLOCKED';
      });
      const newlyPending = DEVICE_ORDER.find(
        (id) => !prev.devices[id].pending && curr.devices[id].pending
      );

      if (hasPreempt) {
        hwSound.playPreempt();
      } else if (curr.stack.length > prev.stack.length) {
        hwSound.playPush();
      } else if (curr.stack.length < prev.stack.length) {
        hwSound.playIret();
      } else if (wokeProcess) {
        hwSound.playWakeup();
      } else if (newlyPending) {
        hwSound.playIrq(curr.devices[newlyPending].irqNumber);
      } else {
        hwSound.playStep(curr.cpu.phase);
      }
      return;
    }

    const manualTriggered = DEVICE_ORDER.find(
      (id) => curr.devices[id].totalTriggered > prev.devices[id].totalTriggered
    );
    if (manualTriggered) {
      hwSound.playIrq(curr.devices[manualTriggered].irqNumber);
    }
  }, [simState, sfxEnabled]);

  useEffect(() => {
    if (!isPlaying) return;
    const ms = SPEED_INTERVAL_MS[speed] ?? 600;
    const timer = window.setInterval(() => {
      setSimState((prev) => stepMicroOp(prev));
    }, ms);
    return () => window.clearInterval(timer);
  }, [isPlaying, speed]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStep();
        return;
      }

      if (liveKeysEnabled && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const scan = keyToScanCode(e.key);
        if (scan) {
          e.preventDefault();
          setSimState((s) => raiseDeviceIrq(s, 'keyboard', scan));
          return;
        }
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReset();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, handleStep, handleReset, liveKeysEnabled]);

  return (
    <div className="flex min-h-screen flex-col bg-[#070A0F] text-slate-200">
      {/* Top Transport Controls & 4-Scenario Deck */}
      <TopControlBar
        state={simState}
        isPlaying={isPlaying}
        speed={speed}
        sfxEnabled={sfxEnabled}
        onTogglePlay={handleTogglePlay}
        onStep={handleStep}
        onReset={handleReset}
        onSpeedChange={setSpeed}
        onSelectPreset={handleSelectPreset}
        onToggleSfx={handleToggleSfx}
      />

      {/* Primary Motherboard Benchtop Schematic */}
      <MotherboardCanvas
        state={simState}
        stepDurationMs={SPEED_INTERVAL_MS[speed] ?? 600}
        liveKeysEnabled={liveKeysEnabled}
        onToggleLiveKeys={() => setLiveKeysEnabled((v) => !v)}
        onTriggerDevice={(id: DeviceId, customPayload?: string) =>
          setSimState((s) => raiseDeviceIrq(s, id, customPayload))
        }
        onTriggerStorm={() => setSimState((s) => triggerIrqStorm(s))}
        onTogglePeriodicTimer={() => setSimState((s) => togglePeriodicTimer(s))}
        onToggleAutoTraffic={() => setSimState((s) => toggleAutoTraffic(s))}
        onToggleMask={(id: DeviceId) => setSimState((s) => toggleDeviceMask(s, id))}
        onChangePriority={(id: DeviceId, priority: number) =>
          setSimState((s) => setDevicePriority(s, id, priority))
        }
        onToggleNested={() => setSimState((s) => toggleNestedInterrupts(s))}
        onRequestPrinterIo={() => setSimState((s) => triggerProcessIoBlock(s))}
      />

      {/* Full-Width 48-Tick Oscilloscope Capture */}
      <LogicAnalyzerStrip state={simState} />

      {/* Bottom 2-Column Telemetry Dock: Execution Trace Log + OS/COA Live Requirements Checklist */}
      <section className="grid grid-cols-1 gap-4 border-t border-[#1E293B] bg-[#070A0F] p-4 lg:grid-cols-[1fr_1.15fr]">
        <TraceLog state={simState} />
        <RequirementsChecklist
          verified={sessionVerified}
          onRunDemo={handleRunDemo}
          onResetChecklist={() => setSessionVerified(createEmptyVerified())}
        />
      </section>
    </div>
  );
};

export default App;
