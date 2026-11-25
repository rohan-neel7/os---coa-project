import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { DEVICE_ACCENTS, SPATIAL_DEVICE_ORDER, toHex } from '../engine/constants';
import type { BusKind, BusSignal, DeviceId, HardwareNodeId, SimState } from '../engine/types';
import { CpuProcessorCard } from './bench/CpuProcessorCard';
import { IoDeviceColumn } from './bench/IoDeviceColumn';
import { MemoryIvtStackPanel } from './bench/MemoryIvtStackPanel';
import { OsProcessBlockCard } from './bench/OsProcessBlockCard';
import { PicChipCard } from './bench/PicChipCard';

interface MotherboardCanvasProps {
  state: SimState;
  stepDurationMs: number;
  liveKeysEnabled: boolean;
  onToggleLiveKeys: () => void;
  onTriggerDevice: (deviceId: DeviceId, customPayload?: string) => void;
  onTriggerStorm: () => void;
  onTogglePeriodicTimer: () => void;
  onToggleAutoTraffic: () => void;
  onToggleMask: (deviceId: DeviceId) => void;
  onChangePriority: (deviceId: DeviceId, priority: number) => void;
  onToggleNested: () => void;
  onRequestPrinterIo: () => void;
}

const BUS_META: Record<BusKind, { color: string; label: string }> = {
  irq: { color: '#F43F5E', label: 'IRQ LINES' },
  control: { color: '#F59E0B', label: 'CONTROL / INTA / EOI' },
  address: { color: '#38BDF8', label: 'ADDRESS / IVT' },
  data: { color: '#10B981', label: 'DATA / PORT READ' },
  os: { color: '#A78BFA', label: 'OS / STACK / SYNC' },
};

interface Point {
  x: number;
  y: number;
}

interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type NodeRectMap = Record<HardwareNodeId, BoxRect>;

function buildStoryBanner(state: SimState): {
  tag: string;
  text: string;
  tone: 'sky' | 'rose' | 'amber' | 'emerald' | 'violet';
} {
  const { cpu, devices, stack, processes } = state;
  const activeDev = cpu.activeIsrDevice ? devices[cpu.activeIsrDevice] : null;
  const ackDev = cpu.pendingAckDevice ? devices[cpu.pendingAckDevice] : null;
  const runningProc = processes.find((p) => p.state === 'RUNNING');
  const blockedProc = processes.find((p) => p.state === 'BLOCKED' && p.blockedOn === 'printer');

  if (stack.length >= 2 && activeDev) {
    return {
      tag: `NESTED PREEMPTION · DEPTH L${stack.length}`,
      text: `${activeDev.name} (P${activeDev.priority}) preempted the outer ISR! Frame #${stack.length} pushed onto Kernel Stack.`,
      tone: 'rose',
    };
  }

  switch (cpu.phase) {
    case 'INT_ACK':
      return {
        tag: 'INT_ACK · PIC ARBITRATION',
        text: ackDev
          ? `CPU asserts INTA → PIC arbitrates ${ackDev.shortLabel} (IRQ${ackDev.irqNumber}) and sends Vector ${toHex(ackDev.vectorId, 2)}.`
          : 'CPU acknowledges highest-priority unmasked interrupt.',
        tone: 'amber',
      };
    case 'CTX_SAVE':
      return {
        tag: 'CTX_SAVE · KERNEL STACK PUSH',
        text: `Pausing execution and pushing PC (${toHex(cpu.PC)}), FLAGS & R0–R3 onto Kernel Stack @ SP=${toHex(cpu.SP)}.`,
        tone: 'amber',
      };
    case 'IVT_LOOKUP': {
      const ivtDev = ackDev ?? activeDev;
      return {
        tag: 'IVT_LOOKUP · VECTOR JUMP',
        text: ivtDev
          ? `Looking up Vector ${toHex(ivtDev.vectorId, 2)} in IVT → Jumping PC to ${toHex(ivtDev.isrAddress)} (${ivtDev.name}).`
          : 'Fetching ISR address from Interrupt Vector Table.',
        tone: 'sky',
      };
    }
    case 'ISR_EXEC_1':
      return {
        tag: `ISR ${activeDev?.shortLabel ?? ''} [1/2] · PORT READ`,
        text: `Reading ${activeDev?.name ?? 'device'} data into R0 and buffering payload in OS I/O Queue.`,
        tone: 'rose',
      };
    case 'ISR_EXEC_2':
      return {
        tag: `ISR ${activeDev?.shortLabel ?? ''} [2/2] · DRIVER & EOI`,
        text: blockedProc
          ? `OS driver drains I/O buffer, sends EOI to PIC, and wakes blocked processes waiting on ${activeDev?.shortLabel}.`
          : `OS driver handles event and sends EOI (End of Interrupt) to clear PIC In-Service register.`,
        tone: 'violet',
      };
    case 'ISR_IRET':
      return {
        tag: 'IRET · CONTEXT RESTORE',
        text: `Popping saved registers, FLAGS & return PC from Kernel Stack to resume prior execution cleanly.`,
        tone: 'emerald',
      };
    case 'INT_CHECK':
      return {
        tag: 'INT_CHECK · POLLING PIC',
        text: 'Instruction completed. CPU inspects PIC INTR line for any unmasked pending interrupts.',
        tone: 'sky',
      };
    default:
      if (runningProc?.pid === 0) {
        return {
          tag: 'CPU IDLE · NON-BUSY WAIT',
          text: blockedProc
            ? `P${blockedProc.pid} (${blockedProc.name}) is BLOCKED on Printer I/O — CPU yields to System Idle until IRQ7 arrives.`
            : 'System Idle active (HLT / WAIT_INT). Trigger any device or press PLAY to run a scenario.',
          tone: 'violet',
        };
      }
      return {
        tag: `${cpu.phase} · MAIN EXECUTION`,
        text: `Executing P${runningProc?.pid ?? 101} (${runningProc?.name ?? 'User'}) @ ${toHex(cpu.PC)} — ${cpu.IR}.`,
        tone: 'sky',
      };
  }
}

const STORY_TONES = {
  sky: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  rose: 'border-rose-500/55 bg-rose-500/15 text-rose-200',
  amber: 'border-amber-500/55 bg-amber-500/15 text-amber-200',
  emerald: 'border-emerald-500/45 bg-emerald-500/10 text-emerald-200',
  violet: 'border-violet-500/50 bg-violet-500/15 text-violet-200',
};

function pointsToPath(pts: Point[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${Math.round(p.x)} ${Math.round(p.y)}`).join(' ');
}

function offsetPathX(pts: Point[], dx: number): Point[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y }));
}

function offsetPathY(pts: Point[], dy: number): Point[] {
  return pts.map((p) => ({ x: p.x, y: p.y + dy }));
}

const SilkscreenLabel: React.FC<{
  x: number;
  y: number;
  text: string;
  color: string;
}> = ({ x, y, text, color }) => {
  const w = Math.max(54, text.length * 5.6 + 12);
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - 10}
        width={w}
        height={13}
        rx={3}
        fill="#070A0F"
        fillOpacity={0.92}
        stroke="#1E293B"
        strokeWidth={0.8}
      />
      <text
        x={x}
        y={y - 1}
        textAnchor="middle"
        fill={color}
        fontSize="8.5"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="700"
      >
        {text}
      </text>
    </g>
  );
};

export const MotherboardCanvas: React.FC<MotherboardCanvasProps> = ({
  state,
  stepDurationMs,
  liveKeysEnabled,
  onToggleLiveKeys,
  onTriggerDevice,
  onTriggerStorm,
  onTogglePeriodicTimer,
  onToggleAutoTraffic,
  onToggleMask,
  onChangePriority,
  onToggleNested,
  onRequestPrinterIo,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Partial<Record<HardwareNodeId, HTMLDivElement | null>>>({});

  const [size, setSize] = useState<{ w: number; h: number }>({ w: 1200, h: 640 });
  const [rects, setRects] = useState<NodeRectMap | null>(null);

  const registerNodeRef = useCallback(
    (id: HardwareNodeId) => (el: HTMLDivElement | null) => {
      nodeRefs.current[id] = el;
    },
    []
  );

  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const ids: HardwareNodeId[] = [
        'keyboard',
        'mouse',
        'printer',
        'timer',
        'pic',
        'os',
        'cpu',
        'ivt',
        'stack',
      ];
      const sBox = stage.getBoundingClientRect();
      const map: Partial<NodeRectMap> = {};
      for (const id of ids) {
        const el = nodeRefs.current[id];
        if (!el) return;
        const b = el.getBoundingClientRect();
        map[id] = {
          x: b.left - sBox.left,
          y: b.top - sBox.top,
          w: b.width,
          h: b.height,
        };
      }
      setSize({ w: Math.max(1, sBox.width), h: Math.max(1, sBox.height) });
      setRects(map as NodeRectMap);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    Object.values(nodeRefs.current).forEach((el) => {
      if (el) ro.observe(el);
    });
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const hasBusActive = (bus: BusKind) => state.activeSignals.some((s) => s.bus === bus);
  const hasSig = (from: HardwareNodeId, to: HardwareNodeId) =>
    state.activeSignals.some((s) => s.from === from && s.to === to);

  const story = buildStoryBanner(state);

  // Build chamfered, non-crossing copper trace routes between all 9 measured nodes
  const traces = rects
    ? (() => {
        const { keyboard, mouse, printer, timer, pic, os, cpu, ivt, stack } = rects;

        // Corridor X positions between columns
        const leftMidX = (keyboard.x + keyboard.w + pic.x) / 2;
        const rightMidX = (pic.x + pic.w + cpu.x) / 2;
        const gapMidY = (pic.y + pic.h + os.y) / 2;

        // 4 left device -> PIC pins (spread vertically on PIC left edge, zero crossings)
        const picLeftTop = pic.y + 62;
        const picLeftSpan = Math.max(84, pic.h - 86);
        const deviceToPic: Record<DeviceId, Point[]> = {
          keyboard: [
            { x: keyboard.x + keyboard.w, y: keyboard.y + keyboard.h * 0.5 },
            { x: leftMidX - 18, y: keyboard.y + keyboard.h * 0.5 },
            { x: leftMidX + 18, y: picLeftTop + picLeftSpan * 0.12 },
            { x: pic.x, y: picLeftTop + picLeftSpan * 0.12 },
          ],
          mouse: [
            { x: mouse.x + mouse.w, y: mouse.y + mouse.h * 0.5 },
            { x: leftMidX - 18, y: mouse.y + mouse.h * 0.5 },
            { x: leftMidX + 18, y: picLeftTop + picLeftSpan * 0.37 },
            { x: pic.x, y: picLeftTop + picLeftSpan * 0.37 },
          ],
          printer: [
            { x: printer.x + printer.w, y: printer.y + printer.h * 0.5 },
            { x: leftMidX - 18, y: printer.y + printer.h * 0.5 },
            { x: leftMidX + 18, y: picLeftTop + picLeftSpan * 0.63 },
            { x: pic.x, y: picLeftTop + picLeftSpan * 0.63 },
          ],
          timer: [
            { x: timer.x + timer.w, y: timer.y + timer.h * 0.5 },
            { x: leftMidX - 18, y: timer.y + timer.h * 0.5 },
            { x: leftMidX + 18, y: picLeftTop + picLeftSpan * 0.88 },
            { x: pic.x, y: picLeftTop + picLeftSpan * 0.88 },
          ],
        };

        // PIC <-> CPU horizontal/chamfered lines
        const picToCpuIrq: Point[] = [
          { x: pic.x + pic.w, y: pic.y + pic.h * 0.36 },
          { x: rightMidX - 6, y: pic.y + pic.h * 0.36 },
          { x: rightMidX + 8, y: cpu.y + cpu.h * 0.3 },
          { x: cpu.x, y: cpu.y + cpu.h * 0.3 },
        ];

        const cpuToPicCtrl: Point[] = [
          { x: cpu.x, y: cpu.y + cpu.h * 0.5 },
          { x: rightMidX + 8, y: cpu.y + cpu.h * 0.5 },
          { x: rightMidX - 6, y: pic.y + pic.h * 0.58 },
          { x: pic.x + pic.w, y: pic.y + pic.h * 0.58 },
        ];

        // CPU <-> OS Process Sync diagonal/chamfered channel
        const cpuToOsSync: Point[] = [
          { x: cpu.x, y: cpu.y + cpu.h * 0.78 },
          { x: rightMidX + 8, y: cpu.y + cpu.h * 0.78 },
          { x: rightMidX - 8, y: os.y + os.h * 0.28 },
          { x: os.x + os.w, y: os.y + os.h * 0.28 },
        ];

        const osToCpuSync: Point[] = [
          { x: os.x + os.w, y: os.y + os.h * 0.44 },
          { x: rightMidX - 8, y: os.y + os.h * 0.44 },
          { x: rightMidX + 8, y: cpu.y + cpu.h * 0.89 },
          { x: cpu.x, y: cpu.y + cpu.h * 0.89 },
        ];

        // CPU bottom pins -> IVT (left) and Kernel Stack (right)
        const cpuToIvt: Point[] = [
          { x: ivt.x + ivt.w * 0.5, y: cpu.y + cpu.h },
          { x: ivt.x + ivt.w * 0.5, y: ivt.y },
        ];

        const cpuToStack: Point[] = [
          { x: stack.x + stack.w * 0.5, y: cpu.y + cpu.h },
          { x: stack.x + stack.w * 0.5, y: stack.y },
        ];

        // Visible corridor-only route for Device -> CPU port reads:
        // exits device right -> left corridor -> horizontal gap under PIC -> right corridor -> CPU Data Port
        const deviceToCpuData = (devId: DeviceId): Point[] => {
          const src = rects[devId];
          return [
            { x: src.x + src.w, y: src.y + src.h * 0.72 },
            { x: leftMidX, y: src.y + src.h * 0.72 },
            { x: leftMidX, y: gapMidY },
            { x: rightMidX, y: gapMidY },
            { x: rightMidX, y: cpu.y + cpu.h * 0.65 },
            { x: cpu.x, y: cpu.y + cpu.h * 0.65 },
          ];
        };

        return {
          leftMidX,
          rightMidX,
          gapMidY,
          deviceToPic,
          picToCpuIrq,
          cpuToPicCtrl,
          cpuToOsSync,
          osToCpuSync,
          cpuToIvt,
          cpuToStack,
          deviceToCpuData,
          fanoutCenterX: pic.x + pic.w * 0.5,
          fanoutTopY: pic.y,
        };
      })()
    : null;

  const getSignalWaypoints = (sig: BusSignal): Point[] => {
    if (!traces) return [{ x: 100, y: 100 }, { x: 200, y: 100 }];
    const { from, to } = sig;

    if (
      (from === 'keyboard' || from === 'mouse' || from === 'printer' || from === 'timer') &&
      to === 'pic'
    ) {
      return traces.deviceToPic[from];
    }
    if (
      (from === 'keyboard' || from === 'mouse' || from === 'printer' || from === 'timer') &&
      to === 'cpu'
    ) {
      return traces.deviceToCpuData(from);
    }
    if (from === 'pic' && to === 'cpu') {
      return sig.bus === 'irq'
        ? traces.picToCpuIrq
        : offsetPathY([...traces.cpuToPicCtrl].reverse(), 8);
    }
    if (from === 'cpu' && to === 'pic') {
      return offsetPathY(traces.cpuToPicCtrl, -8);
    }
    if (from === 'cpu' && to === 'os') {
      return traces.cpuToOsSync;
    }
    if (from === 'os' && to === 'cpu') {
      return traces.osToCpuSync;
    }
    if (from === 'cpu' && to === 'ivt') {
      return offsetPathX(traces.cpuToIvt, -12);
    }
    if (from === 'ivt' && to === 'cpu') {
      return offsetPathX([...traces.cpuToIvt].reverse(), 12);
    }
    if (from === 'cpu' && to === 'stack') {
      return offsetPathX(traces.cpuToStack, -12);
    }
    if (from === 'stack' && to === 'cpu') {
      return offsetPathX([...traces.cpuToStack].reverse(), 12);
    }
    return traces.picToCpuIrq;
  };

  // Scale animation travel duration smoothly with playback speed so packets finish cleanly within each tick
  const travelSec = Math.min(0.46, Math.max(0.15, (stepDurationMs * 0.62) / 1000));
  const staggerStep = Math.min(0.14, travelSec * 0.42);

  return (
    <main className="benchtop-mat relative flex flex-1 flex-col justify-between overflow-x-hidden px-4 pt-4 pb-6">
      {/* Top Step Narration Banner */}
      <motion.div
        key={story.tag}
        initial={{ opacity: 0.65, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3.5 py-2 backdrop-blur-sm ${STORY_TONES[story.tone]}`}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="font-mono text-[11px] font-bold tracking-wider">{story.tag}</span>
          <span className="hidden opacity-50 sm:inline">—</span>
          <span className="text-xs leading-snug opacity-95">{story.text}</span>
        </div>
      </motion.div>

      {/* Measured 3-Column Motherboard Schematic Stage */}
      <div ref={stageRef} className="relative flex-1">
        {/* Layer 1 (z-0): Static & Illuminated Copper PCB Traces + Silkscreen Labels */}
        {traces && (
          <svg
            viewBox={`0 0 ${size.w} ${size.h}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full lg:block"
          >
            <defs>
              <filter id="pcb-bloom" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Subtle Decorative Motherboard Bus Fanout Traces above PIC */}
            <g opacity="0.22" stroke="#475569" strokeWidth="1" fill="none">
              {[-36, -24, -12, 0, 12, 24, 36].map((offset, idx) => (
                <path
                  key={idx}
                  d={`M ${traces.fanoutCenterX + offset * 0.55} ${traces.fanoutTopY} L ${traces.fanoutCenterX + offset * 0.55} ${Math.max(4, traces.fanoutTopY - 24)} L ${traces.fanoutCenterX + offset * 1.9} ${Math.max(4, traces.fanoutTopY - 50)}`}
                />
              ))}
            </g>

            {/* Shared Data Port-Read Bus Rail (subtle corridor trace under PIC) */}
            {(() => {
              const dataReadActive = state.activeSignals.some(
                (s) =>
                  (s.from === 'keyboard' ||
                    s.from === 'mouse' ||
                    s.from === 'printer' ||
                    s.from === 'timer') &&
                  s.to === 'cpu'
              );
              const pts: Point[] = [
                { x: traces.leftMidX, y: traces.gapMidY },
                { x: traces.rightMidX, y: traces.gapMidY },
              ];
              return (
                <g>
                  <path
                    d={pointsToPath(pts)}
                    fill="none"
                    stroke={dataReadActive ? '#10B981' : '#1E293B'}
                    strokeWidth={dataReadActive ? 2.4 : 1.2}
                    strokeDasharray={dataReadActive ? 'none' : '4 4'}
                    opacity={dataReadActive ? 0.95 : 0.65}
                    filter={dataReadActive ? 'url(#pcb-bloom)' : undefined}
                  />
                  <SilkscreenLabel
                    x={(traces.leftMidX + traces.rightMidX) / 2}
                    y={traces.gapMidY + 4}
                    text="DATA BUS"
                    color={dataReadActive ? '#6EE7B7' : '#64748B'}
                  />
                </g>
              );
            })()}

            {/* 4 Explicit Left Device -> PIC IRQ Copper Traces */}
            {SPATIAL_DEVICE_ORDER.map((devId) => {
              const dev = state.devices[devId];
              const pts = traces.deviceToPic[devId];
              const accent = DEVICE_ACCENTS[devId].color;
              const isActive = dev.pending || dev.inService || hasSig(devId, 'pic');
              const startPt = pts[0];
              const endPt = pts[pts.length - 1];

              return (
                <g key={devId}>
                  <path
                    d={pointsToPath(pts)}
                    fill="none"
                    stroke={isActive ? accent : '#263449'}
                    strokeWidth={isActive ? 2.6 : 1.5}
                    opacity={isActive ? 0.95 : 0.72}
                    filter={isActive ? 'url(#pcb-bloom)' : undefined}
                  />
                  <circle
                    cx={startPt.x}
                    cy={startPt.y}
                    r="3.2"
                    fill="#070A0F"
                    stroke={isActive ? accent : '#475569'}
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={endPt.x}
                    cy={endPt.y}
                    r="3.2"
                    fill="#070A0F"
                    stroke={isActive ? accent : '#475569'}
                    strokeWidth="1.5"
                  />
                  <SilkscreenLabel
                    x={traces.leftMidX}
                    y={(pts[0].y + pts[3].y) / 2 + 4}
                    text={`${dev.shortLabel} IRQ${dev.irqNumber}`}
                    color={isActive ? accent : '#94A3B8'}
                  />
                </g>
              );
            })}

            {/* PIC -> CPU IRQ Line */}
            {(() => {
              const active = hasBusActive('irq') || state.cpu.activeIsrDevice !== null;
              const pts = traces.picToCpuIrq;
              return (
                <g>
                  <path
                    d={pointsToPath(pts)}
                    fill="none"
                    stroke={active ? '#F43F5E' : '#263449'}
                    strokeWidth={active ? 2.6 : 1.5}
                    filter={active ? 'url(#pcb-bloom)' : undefined}
                  />
                  <SilkscreenLabel
                    x={traces.rightMidX}
                    y={pts[0].y - 7}
                    text="IRQ / INTR"
                    color={active ? '#FDA4AF' : '#94A3B8'}
                  />
                </g>
              );
            })()}

            {/* CPU <-> PIC Control (INTA / EOI) */}
            {(() => {
              const active =
                hasSig('cpu', 'pic') || (hasSig('pic', 'cpu') && hasBusActive('control'));
              const pts = traces.cpuToPicCtrl;
              return (
                <g>
                  <path
                    d={pointsToPath(pts)}
                    fill="none"
                    stroke={active ? '#F59E0B' : '#263449'}
                    strokeWidth={active ? 2.6 : 1.5}
                    filter={active ? 'url(#pcb-bloom)' : undefined}
                  />
                  <SilkscreenLabel
                    x={traces.rightMidX}
                    y={pts[3].y + 14}
                    text="INTA / EOI"
                    color={active ? '#FDE68A' : '#94A3B8'}
                  />
                </g>
              );
            })()}

            {/* CPU <-> OS I/O Synchronization Channel */}
            {(() => {
              const active = hasBusActive('os') || hasSig('cpu', 'os') || hasSig('os', 'cpu');
              return (
                <g>
                  <path
                    d={pointsToPath(traces.cpuToOsSync)}
                    fill="none"
                    stroke={active ? '#A78BFA' : '#263449'}
                    strokeWidth={active ? 2.4 : 1.4}
                    filter={active ? 'url(#pcb-bloom)' : undefined}
                  />
                  <path
                    d={pointsToPath(traces.osToCpuSync)}
                    fill="none"
                    stroke={active ? '#34D399' : '#263449'}
                    strokeWidth={active ? 2.2 : 1.4}
                    strokeDasharray="4 3"
                  />
                  <SilkscreenLabel
                    x={traces.rightMidX}
                    y={traces.cpuToOsSync[3].y - 10}
                    text="I/O SYNC"
                    color={active ? '#DDD6FE' : '#94A3B8'}
                  />
                </g>
              );
            })()}

            {/* CPU <-> IVT Memory Channel */}
            {(() => {
              const active =
                state.cpu.phase === 'IVT_LOOKUP' || hasSig('cpu', 'ivt') || hasSig('ivt', 'cpu');
              const pts = traces.cpuToIvt;
              return (
                <g>
                  <path
                    d={pointsToPath(pts)}
                    fill="none"
                    stroke={active ? '#38BDF8' : '#263449'}
                    strokeWidth={active ? 2.6 : 1.5}
                    filter={active ? 'url(#pcb-bloom)' : undefined}
                  />
                  <SilkscreenLabel
                    x={pts[0].x - 32}
                    y={(pts[0].y + pts[1].y) / 2 + 4}
                    text="IVT"
                    color={active ? '#7DD3FC' : '#94A3B8'}
                  />
                </g>
              );
            })()}

            {/* CPU <-> Kernel Stack Channel */}
            {(() => {
              const active =
                state.cpu.phase === 'CTX_SAVE' ||
                state.cpu.phase === 'ISR_IRET' ||
                hasSig('cpu', 'stack') ||
                hasSig('stack', 'cpu');
              const pts = traces.cpuToStack;
              return (
                <g>
                  <path
                    d={pointsToPath(pts)}
                    fill="none"
                    stroke={active ? '#A78BFA' : '#263449'}
                    strokeWidth={active ? 2.6 : 1.5}
                    filter={active ? 'url(#pcb-bloom)' : undefined}
                  />
                  <SilkscreenLabel
                    x={pts[0].x + 36}
                    y={(pts[0].y + pts[1].y) / 2 + 4}
                    text="STACK"
                    color={active ? '#DDD6FE' : '#94A3B8'}
                  />
                </g>
              );
            })()}
          </svg>
        )}

        {/* 3-Column Motherboard Schematic Grid (z-10) */}
        <div className="relative z-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(240px,0.92fr)_minmax(265px,0.98fr)_minmax(370px,1.25fr)] lg:gap-x-24 xl:gap-x-28">
          {/* Column 1: 4 Hardware I/O Devices */}
          <IoDeviceColumn
            state={state}
            liveKeysEnabled={liveKeysEnabled}
            onToggleLiveKeys={onToggleLiveKeys}
            onTriggerDevice={onTriggerDevice}
            onTriggerStorm={onTriggerStorm}
            onTogglePeriodicTimer={onTogglePeriodicTimer}
            onToggleAutoTraffic={onToggleAutoTraffic}
            registerNodeRef={registerNodeRef}
          />

          {/* Column 2: PIC IC Package + OS Process Sync Block */}
          <div className="flex flex-col gap-12">
            <PicChipCard
              state={state}
              onToggleMask={onToggleMask}
              onChangePriority={onChangePriority}
              onToggleNested={onToggleNested}
              nodeRef={registerNodeRef('pic')}
            />
            <OsProcessBlockCard
              state={state}
              onRequestPrinterIo={onRequestPrinterIo}
              nodeRef={registerNodeRef('os')}
            />
          </div>

          {/* Column 3: CPU Processor QFP Package + Memory (IVT & Kernel Stack) */}
          <div className="flex flex-col gap-12">
            <CpuProcessorCard state={state} nodeRef={registerNodeRef('cpu')} />
            <MemoryIvtStackPanel
              state={state}
              ivtRef={registerNodeRef('ivt')}
              stackRef={registerNodeRef('stack')}
            />
          </div>
        </div>

        {/* Layer 2 (z-20): Animated Signal Pulses & Destination Ripples Above Card Edges */}
        {traces && (
          <svg
            viewBox={`0 0 ${size.w} ${size.h}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 hidden h-full w-full overflow-visible lg:block"
          >
            <defs>
              <filter id="pulse-bloom" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <AnimatePresence>
              {state.activeSignals.map((sig: BusSignal, idx: number) => {
                const pts = getSignalWaypoints(sig);
                const color = BUS_META[sig.bus].color;
                const xs = pts.map((p) => p.x);
                const ys = pts.map((p) => p.y);
                const end = pts[pts.length - 1];
                const delay = idx * staggerStep;
                const pillW = Math.max(72, Math.min(132, sig.label.length * 6.5 + 18));

                return (
                  <motion.g
                    key={sig.id}
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                  >
                    {/* Outer translation-only group (never animates scale, avoiding origin jumps) */}
                    <motion.g
                      initial={{ x: xs[0], y: ys[0] }}
                      animate={{ x: xs, y: ys }}
                      transition={{ duration: travelSec, delay, ease: 'easeInOut' }}
                      filter="url(#pulse-bloom)"
                    >
                      {/* Inner centered scale/opacity group */}
                      <motion.g
                        initial={{ opacity: 0, scale: 0.72 }}
                        animate={{ opacity: [0, 1, 1], scale: [0.72, 1.06, 1] }}
                        transition={{ duration: travelSec, delay, ease: 'easeOut' }}
                      >
                        <circle r="11" fill={color} opacity={0.26} />
                        <circle r="5.5" fill={color} />
                        <circle r="2" fill="#FFFFFF" />
                        <rect
                          x={-pillW / 2}
                          y="-24"
                          width={pillW}
                          height="16"
                          rx="4"
                          fill="#070A0F"
                          stroke={color}
                          strokeWidth="1.25"
                        />
                        <text
                          x="0"
                          y="-13"
                          textAnchor="middle"
                          fill="#F8FAFC"
                          fontSize="9"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="700"
                        >
                          {sig.label.slice(0, 16)}
                        </text>
                      </motion.g>
                    </motion.g>

                    {/* Destination Solder Pad Arrival Ripple */}
                    <motion.circle
                      cx={end.x}
                      cy={end.y}
                      initial={{ r: 3, opacity: 0 }}
                      animate={{ r: [3, 16], opacity: [0, 0.85, 0] }}
                      transition={{ duration: 0.4, delay: delay + travelSec * 0.72 }}
                      fill="none"
                      stroke={color}
                      strokeWidth="1.6"
                    />
                  </motion.g>
                );
              })}
            </AnimatePresence>
          </svg>
        )}
      </div>

      {/* Bus Legend & Active Signals Strip */}
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#1E293B] bg-[#0B101A]/95 px-3.5 py-2 font-mono text-[10px]">
        <div className="flex flex-wrap items-center gap-4">
          {(Object.keys(BUS_META) as BusKind[]).map((bus) => {
            const active = hasBusActive(bus);
            return (
              <div
                key={bus}
                className={`flex items-center gap-1.5 transition-opacity ${
                  active ? 'opacity-100' : 'opacity-65'
                }`}
              >
                <span
                  className="inline-block h-2 w-4 rounded-xs"
                  style={{
                    backgroundColor: BUS_META[bus].color,
                    boxShadow: active ? `0 0 10px ${BUS_META[bus].color}` : 'none',
                  }}
                />
                <span className={active ? 'font-bold text-slate-100' : 'text-slate-400'}>
                  {BUS_META[bus].label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {state.activeSignals.length === 0 ? (
            <span className="text-slate-500">BUS IDLE</span>
          ) : (
            state.activeSignals.map((sig) => (
              <motion.span
                key={sig.id}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded border px-1.5 py-0.5 text-[9px] font-semibold text-slate-100"
                style={{
                  borderColor: BUS_META[sig.bus].color,
                  backgroundColor: `${BUS_META[sig.bus].color}22`,
                }}
              >
                {sig.label}
              </motion.span>
            ))
          )}
        </div>
      </footer>
    </main>
  );
};
