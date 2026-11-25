# IRQ-Trace: Interrupt Handling & I/O Management Simulator

Interactive dark-mode hardware benchtop & oscilloscope simulator demonstrating how **Operating Systems (OS)** and **Computer Organization & Architecture (COA)** coordinate hardware interrupts, interrupt controllers, vector lookups, context switching, and non-busy-wait process synchronization.

## Features

- **3-Column Motherboard Schematic Benchtop:**
  - **I/O Devices (`IRQ0`, `IRQ1`, `IRQ3`, `IRQ7`):** Custom inline SVG illustrations and interactive triggers for **Keyboard** (mechanical keycaps + live typing capture), **Mouse HID** (clickable XY optical sensor pad), **Printer / DMA** (spooler completion), and **PIT Timer** (manual & periodic tick), plus 1-click **IRQ Storm** and **Burst** modes.
  - **Interrupt Controller (`PIC 8259A`):** Live `IRR` / `ISR` LEDs, configurable `P1–P4` priority arbitration, per-line `EN`/`MSK` gating, and **Nested Preemption** support.
  - **CPU Processor & Memory:** Live registers (`PC`, `SP`, `R0–R3`, `IR`, `FLAGS`), animated **Instruction Execution Cycle** (`FETCH` → `DECODE` → `EXECUTE` → `INT CHECK`), **Interrupt Handling Pipeline** (`INT ACK` → `SAVE CTX` → `IVT` → `ISR 1` → `ISR 2` → `IRET`), **Interrupt Vector Table (IVT)**, and multi-frame **Kernel Stack**.
  - **OS I/O & Process Layer:** Shows `RUNNING`, `READY`, and `BLOCKED ON I/O` process transitions with non-busy-wait yielding to `System Idle` and interrupt-driven wakeups.
- **48-Tick Oscilloscope Strip, Trace Log & Live Requirements Checklist:** Tracks CPU state, active IRQ edges, bus cycles, and live verification across all 10 OS + COA concepts.
- **4 Built-in Demo Presets:**
  1. Single Keyboard Interrupt
  2. Interrupt Storm (Priority Queueing)
  3. Nested Preemption (2-level Kernel Stack unwind)
  4. OS I/O Wait & Wakeup

## Local Development

```bash
npm install
npm run dev
```

## Testing & Production Build

```bash
npm test
npm run build
```

## GitHub Pages Deployment

Push to `main` and enable **Settings → Pages → Source: GitHub Actions**. The included workflow at `.github/workflows/deploy.yml` runs `npm ci`, `npm test`, `npm run build`, and deploys `./dist`.
