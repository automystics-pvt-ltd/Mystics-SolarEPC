import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface ShellProps {
  children: ReactNode;
}

/**
 * RenewableWatermark
 * Professional renewable-energy landscape watermark:
 *   • Sun with layered rays (top-right)
 *   • Three wind turbines on the horizon
 *   • Perspective solar-panel field (vanishing point at horizon)
 * All elements are drawn in warm amber + navy at very low opacity and
 * dissolved at the edges via a radial fog mask — visible in every
 * white-space gap between cards without competing with any content.
 */
function RenewableWatermark() {
  const amber = "#d97706";
  const navy  = "#0c1445";

  // ── Composition constants ─────────────────────────────────────────
  const VW  = 1400;   // viewBox width
  const VH  = 820;    // viewBox height
  const HY  = 400;    // horizon Y
  const VPX = 700;    // perspective vanishing-point X (centre)

  // ── 1. SUN (top-right, above horizon) ────────────────────────────
  const SX = 1060;
  const SY = 210;
  const sunRays = Array.from({ length: 20 }, (_, i) => {
    const a    = (i * (360 / 20) * Math.PI) / 180;
    const long = i % 2 === 0;
    return { a, r1: long ? 88 : 80, r2: long ? 128 : 108, w: long ? 3.5 : 2 };
  });

  // ── 2. WIND TURBINES (on horizon line) ───────────────────────────
  const turbines = [
    { cx: 200, towerH: 220, bladeR: 88,  scale: 1.0  },
    { cx: 430, towerH: 170, bladeR: 68,  scale: 0.80 },
    { cx: 1220,towerH: 195, bladeR: 78,  scale: 0.90 },
  ];

  function WindTurbine({ cx, towerH, bladeR, scale }: typeof turbines[0]) {
    const baseW = 14 * scale;
    const topW  = 6  * scale;
    const baseY = HY + 4;
    const topY  = HY - towerH;
    const nacW  = 26 * scale;
    const nacH  = 12 * scale;

    // 3 blades at 0°, 120°, 240° — tip angle offset per turbine for variety
    const bladeAngles = [cx * 0.003, cx * 0.003 + 2.094, cx * 0.003 + 4.189];

    return (
      <g opacity="1">
        {/* Tower (tapered trapezoid) */}
        <polygon
          points={`
            ${cx - baseW / 2},${baseY}
            ${cx + baseW / 2},${baseY}
            ${cx + topW  / 2},${topY}
            ${cx - topW  / 2},${topY}
          `}
          fill={navy} fillOpacity="0.08"
          stroke={navy} strokeWidth="1" strokeOpacity="0.10"
        />
        {/* Nacelle */}
        <rect
          x={cx - nacW / 2} y={topY - nacH}
          width={nacW} height={nacH}
          rx={3 * scale}
          fill={navy} fillOpacity="0.10"
          stroke={navy} strokeWidth="0.8" strokeOpacity="0.10"
        />
        {/* Hub */}
        <circle cx={cx} cy={topY - nacH * 0.5} r={5 * scale}
          fill={navy} fillOpacity="0.12" />
        {/* Three blades */}
        {bladeAngles.map((angle, i) => {
          const tipX = cx + Math.cos(angle) * bladeR;
          const tipY = topY - nacH * 0.5 + Math.sin(angle) * bladeR;
          // blade as a narrow tapered path
          const side = (angle + Math.PI / 2);
          const sw   = 5 * scale;
          const bx1  = cx + Math.cos(side) * sw * 0.4;
          const by1  = topY - nacH * 0.5 + Math.sin(side) * sw * 0.4;
          const bx2  = cx - Math.cos(side) * sw * 0.4;
          const by2  = topY - nacH * 0.5 - Math.sin(side) * sw * 0.4;
          return (
            <path
              key={i}
              d={`M ${bx1.toFixed(1)},${by1.toFixed(1)}
                  L ${tipX.toFixed(1)},${tipY.toFixed(1)}
                  L ${bx2.toFixed(1)},${by2.toFixed(1)} Z`}
              fill={navy} fillOpacity="0.09"
              stroke={navy} strokeWidth="0.6" strokeOpacity="0.10"
            />
          );
        })}
      </g>
    );
  }

  // ── 3. SOLAR PANEL FIELD (perspective grid below horizon) ─────────
  // 8 rows, front-to-back (i=0 is nearest/largest)
  const ROWS      = 9;
  const NEAR_Y    = 755;     // front edge Y
  const FAR_Y     = HY + 28; // back edge Y (just below horizon)
  const NEAR_HALF = 380;     // half-width at front
  const FAR_HALF  = 80;      // half-width at horizon

  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

  const panelRows: JSX.Element[] = [];

  for (let i = 0; i < ROWS; i++) {
    // t=0 → nearest row, t=1 → farthest row
    const tB = i       / ROWS;
    const tT = (i + 1) / ROWS;

    const rowBotY = lerp(NEAR_Y, FAR_Y, tB);
    const rowTopY = lerp(NEAR_Y, FAR_Y, tT);

    const botHalf = lerp(NEAR_HALF, FAR_HALF, tB);
    const topHalf = lerp(NEAR_HALF, FAR_HALF, tT);

    const x0 = VPX - botHalf; const x1 = VPX + botHalf;
    const x2 = VPX + topHalf; const x3 = VPX - topHalf;

    // Row height for opacity (nearer = slightly more visible)
    const rowOpacity = 0.06 + (1 - tB) * 0.06;

    // Row fill band
    panelRows.push(
      <polygon key={`row-${i}`}
        points={`${x0},${rowBotY} ${x1},${rowBotY} ${x2},${rowTopY} ${x3},${rowTopY}`}
        fill={navy} fillOpacity={rowOpacity * 0.55}
        stroke={navy} strokeWidth="0.8" strokeOpacity={rowOpacity}
      />
    );

    // Vertical cell dividers (convergent lines to vanishing point)
    const nDividers = Math.max(3, 9 - i * 1);
    for (let d = 1; d < nDividers; d++) {
      const tD  = d / nDividers;
      const dxB = x0 + (x1 - x0) * tD;
      const dxT = x3 + (x2 - x3) * tD;
      panelRows.push(
        <line key={`div-${i}-${d}`}
          x1={dxB} y1={rowBotY}
          x2={dxT} y2={rowTopY}
          stroke={navy} strokeWidth="0.6" strokeOpacity={rowOpacity * 0.7}
        />
      );
    }

    // Panel tilt line (horizontal bar mid-row, shows tilt angle)
    const midY   = (rowBotY + rowTopY) / 2;
    const midHL  = lerp(botHalf, topHalf, 0.5);
    const tiltOff = (rowBotY - rowTopY) * 0.18;
    panelRows.push(
      <line key={`tilt-${i}`}
        x1={VPX - midHL * 0.92} y1={midY + tiltOff}
        x2={VPX + midHL * 0.92} y2={midY - tiltOff}
        stroke={amber} strokeWidth="0.8" strokeOpacity={rowOpacity * 0.5}
      />
    );
  }

  // ── 4. GROUND PLANE (below horizon) ──────────────────────────────
  // Perspective ground lines radiating from vanishing point
  const groundLines: JSX.Element[] = [];
  const groundAngles = [-70, -45, -25, -12, 12, 25, 45, 70];
  groundAngles.forEach((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    groundLines.push(
      <line key={`g-${i}`}
        x1={VPX} y1={HY}
        x2={VPX + Math.cos(Math.PI / 2 + rad) * 900}
        y2={HY  + Math.abs(Math.sin(Math.PI / 2 + rad)) * 900}
        stroke={navy} strokeWidth="0.8" strokeOpacity="0.04"
      />
    );
  });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{
        position      : "absolute",
        inset         : 0,
        width         : "100%",
        height        : "100%",
        pointerEvents : "none",
        userSelect    : "none",
      }}
    >
      <defs>
        {/* Sky gradient — warm haze above horizon */}
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#fef9ee" stopOpacity="0"    />
          <stop offset="55%" stopColor="#fef3c7" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fef3c7" stopOpacity="0"   />
        </linearGradient>

        {/* Sun warm radial glow */}
        <radialGradient id="sun-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={amber} stopOpacity="0.22" />
          <stop offset="50%"  stopColor={amber} stopOpacity="0.07" />
          <stop offset="100%" stopColor={amber} stopOpacity="0"    />
        </radialGradient>

        {/* Ground fade — panels dissolve at bottom */}
        <linearGradient id="ground-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="white" stopOpacity="1" />
          <stop offset="72%"  stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="ground-mask">
          <rect width={VW} height={VH} fill="url(#ground-fade)" />
        </mask>

        {/* Side fade — turbines dissolve at left/right edges */}
        <linearGradient id="side-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="white" stopOpacity="0"   />
          <stop offset="12%"  stopColor="white" stopOpacity="1"   />
          <stop offset="88%"  stopColor="white" stopOpacity="1"   />
          <stop offset="100%" stopColor="white" stopOpacity="0"   />
        </linearGradient>
        <mask id="side-mask">
          <rect width={VW} height={VH} fill="url(#side-fade)" />
        </mask>

        {/* Full scene edge dissolve */}
        <radialGradient id="scene-fog" cx="50%" cy="55%" r="58%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="white" stopOpacity="1"   />
          <stop offset="60%"  stopColor="white" stopOpacity="0.85"/>
          <stop offset="85%"  stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0"   />
        </radialGradient>
        <mask id="scene-mask">
          <rect width={VW} height={VH} fill="url(#scene-fog)" />
        </mask>
      </defs>

      {/* ── Sky atmosphere ── */}
      <rect width={VW} height={VH} fill="url(#sky)" />

      {/* ── Horizon line ── */}
      <line x1="0" y1={HY} x2={VW} y2={HY}
        stroke={navy} strokeWidth="0.8" strokeOpacity="0.07" />

      {/* ══ ALL SCENE ELEMENTS — full edge dissolve ════════════════ */}
      <g mask="url(#scene-mask)">

        {/* ── Ground perspective lines ── */}
        {groundLines}

        {/* ── Sun glow halo ── */}
        <circle cx={SX} cy={SY} r="260" fill="url(#sun-halo)" />

        {/* ── Sun disc + rays ── */}
        {sunRays.map(({ a, r1, r2, w }, i) => (
          <line key={i}
            x1={SX + Math.cos(a) * r1} y1={SY + Math.sin(a) * r1}
            x2={SX + Math.cos(a) * r2} y2={SY + Math.sin(a) * r2}
            stroke={amber}
            strokeWidth={w}
            strokeLinecap="round"
            strokeOpacity={i % 2 === 0 ? 0.18 : 0.10}
          />
        ))}
        <circle cx={SX} cy={SY} r="72"  fill={amber} fillOpacity="0.11" />
        <circle cx={SX} cy={SY} r="52"  fill={amber} fillOpacity="0.09" />
        <circle cx={SX} cy={SY} r="34"  fill={amber} fillOpacity="0.07" />

        {/* ── Wind turbines (with side-fade so edges dissolve) ── */}
        <g mask="url(#side-mask)">
          {turbines.map((t, i) => <WindTurbine key={i} {...t} />)}
        </g>

        {/* ── Solar panel field (with ground-fade) ── */}
        <g mask="url(#ground-mask)">
          {panelRows}
        </g>

        {/* ── Lettermark ── */}
        <text
          x={VPX} y={HY - 30}
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="13"
          fontWeight="700"
          letterSpacing="9"
          fill={navy}
          fillOpacity="0.07"
        >
          MYSTICS ERP
        </text>
        <text
          x={VPX} y={HY - 14}
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="8"
          fontWeight="400"
          letterSpacing="5"
          fill={navy}
          fillOpacity="0.05"
        >
          ERP &amp; PROJECT MANAGEMENT
        </text>
      </g>
    </svg>
  );
}

export function Shell({ children }: ShellProps) {
  return (
    <div
      className="flex h-[100dvh] w-full overflow-hidden"
      style={{ background: "#F2EDD8" }}
    >
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden" style={{ position: "relative" }}>
        <Topbar />

        {/* Watermark — fixed behind all content */}
        <div
          style={{
            position      : "absolute",
            top           : "56px",
            left          : 0,
            right         : 0,
            bottom        : 0,
            zIndex        : 0,
            overflow      : "hidden",
            pointerEvents : "none",
          }}
        >
          <RenewableWatermark />
        </div>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ position: "relative", zIndex: 1, backgroundColor: "transparent" }}
        >
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
