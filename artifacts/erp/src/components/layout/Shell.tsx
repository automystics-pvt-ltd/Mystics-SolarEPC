import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface ShellProps {
  children: ReactNode;
}

/**
 * SolarWatermark
 * Professional ghost-layer SVG — sun + solar panel array — shown behind all
 * page content. Fixed to the viewport so it's always visible regardless of
 * scroll position. Opacity values are tuned per-element so the motif reads
 * clearly in empty white space without competing with text or data.
 */
function SolarWatermark() {
  const amber = "#d97706";
  const navy  = "#0c1445";

  /* ── Sun ray angles (16 rays, alternating long/short) ── */
  const rays = Array.from({ length: 16 }, (_, i) => {
    const deg = i * (360 / 16);
    const rad = (deg * Math.PI) / 180;
    const inner = i % 2 === 0 ? 115 : 108;
    const outer = i % 2 === 0 ? 155 : 138;
    return { rad, inner, outer, thick: i % 4 === 0 };
  });

  /* ── Panel grid: 7 cols × 3 rows ── */
  const PANEL_W = 92;
  const PANEL_H = 56;
  const GAP_X   = 10;
  const GAP_Y   = 10;
  const COLS     = 7;
  const ROWS     = 3;
  const arrayW   = COLS * PANEL_W + (COLS - 1) * GAP_X;
  const arrayStartX = (1400 - arrayW) / 2;   // centred in viewBox
  const arrayStartY = 530;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1400 860"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{
        position : "absolute",
        inset    : 0,
        width    : "100%",
        height   : "100%",
        pointerEvents : "none",
        userSelect    : "none",
      }}
    >
      <defs>
        {/* Warm radial glow behind the sun */}
        <radialGradient id="wm-sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={amber} stopOpacity="0.22" />
          <stop offset="60%"  stopColor={amber} stopOpacity="0.07" />
          <stop offset="100%" stopColor={amber} stopOpacity="0"    />
        </radialGradient>

        {/* Vertical fade on the panel array so it dissolves at the bottom */}
        <linearGradient id="wm-panel-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopOpacity="1"   stopColor="white" />
          <stop offset="85%"  stopOpacity="1"   stopColor="white" />
          <stop offset="100%" stopOpacity="0"   stopColor="white" />
        </linearGradient>
        <mask id="wm-panel-mask">
          <rect x="0" y={arrayStartY - 20} width="1400" height="380" fill="url(#wm-panel-fade)" />
        </mask>
      </defs>

      {/* ══ 1. SUN SECTION (top-right) ══════════════════════════════════ */}
      <g transform="translate(1100, 200)">
        {/* Outer glow halo */}
        <circle cx="0" cy="0" r="240" fill="url(#wm-sun-glow)" />

        {/* Rays */}
        {rays.map(({ rad, inner, outer, thick }, i) => (
          <line
            key={i}
            x1={Math.cos(rad) * inner}
            y1={Math.sin(rad) * inner}
            x2={Math.cos(rad) * outer}
            y2={Math.sin(rad) * outer}
            stroke={amber}
            strokeWidth={thick ? 5 : 2.5}
            strokeLinecap="round"
            strokeOpacity={thick ? 0.22 : 0.14}
          />
        ))}

        {/* Sun disc */}
        <circle cx="0" cy="0" r="88" fill={amber} fillOpacity="0.12" />
        <circle cx="0" cy="0" r="72" fill={amber} fillOpacity="0.10" />
        <circle cx="0" cy="0" r="52" fill={amber} fillOpacity="0.08" />
      </g>

      {/* ══ 2. ENERGY FLOW LINE — sun → panels ══════════════════════════ */}
      {/* Vertical drop from sun center, then horizontal to panel array */}
      <path
        d={`M 1100 400 L 1100 510 L ${arrayStartX + arrayW / 2} 510 L ${arrayStartX + arrayW / 2} ${arrayStartY}`}
        fill="none"
        stroke={amber}
        strokeWidth="2"
        strokeOpacity="0.09"
        strokeDasharray="8 6"
        strokeLinecap="round"
      />

      {/* ══ 3. SOLAR PANEL ARRAY ════════════════════════════════════════ */}
      <g mask="url(#wm-panel-mask)">
        {/* Horizontal mounting rails */}
        {Array.from({ length: ROWS + 1 }, (_, r) => {
          const y = arrayStartY + r * (PANEL_H + GAP_Y) - GAP_Y / 2;
          return (
            <line
              key={`rail-${r}`}
              x1={arrayStartX - 8}
              y1={y}
              x2={arrayStartX + arrayW + 8}
              y2={y}
              stroke={navy}
              strokeWidth="3.5"
              strokeOpacity="0.08"
              strokeLinecap="round"
            />
          );
        })}

        {/* Panels */}
        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => {
            const px = arrayStartX + col * (PANEL_W + GAP_X);
            const py = arrayStartY + row * (PANEL_H + GAP_Y);
            return (
              <g key={`p-${row}-${col}`} transform={`translate(${px}, ${py})`}>
                {/* Panel body */}
                <rect
                  width={PANEL_W} height={PANEL_H} rx="3"
                  fill={navy} fillOpacity="0.05"
                  stroke={navy} strokeWidth="1.8" strokeOpacity="0.12"
                />
                {/* Internal cell grid — 4 cols × 3 rows */}
                {Array.from({ length: 3 }, (_, cr) =>
                  Array.from({ length: 4 }, (_, cc) => (
                    <rect
                      key={`c-${cr}-${cc}`}
                      x={4 + cc * 21} y={4 + cr * 16}
                      width={18} height={13} rx="1"
                      fill={navy} fillOpacity="0.06"
                      stroke={navy} strokeWidth="0.8" strokeOpacity="0.08"
                    />
                  ))
                )}
                {/* Centre busbar cross */}
                <line x1={PANEL_W / 2} y1="3" x2={PANEL_W / 2} y2={PANEL_H - 3}
                      stroke={navy} strokeWidth="1" strokeOpacity="0.07" />
                <line x1="3" y1={PANEL_H / 2} x2={PANEL_W - 3} y2={PANEL_H / 2}
                      stroke={navy} strokeWidth="1" strokeOpacity="0.07" />
              </g>
            );
          })
        )}

        {/* Vertical strut legs under each column */}
        {Array.from({ length: COLS }, (_, col) => {
          const strutX = arrayStartX + col * (PANEL_W + GAP_X) + PANEL_W / 2;
          const strutTop = arrayStartY + ROWS * (PANEL_H + GAP_Y) - GAP_Y / 2;
          return (
            <line
              key={`strut-${col}`}
              x1={strutX} y1={strutTop}
              x2={strutX} y2={strutTop + 28}
              stroke={navy} strokeWidth="2.5"
              strokeOpacity="0.07" strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* ══ 4. LETTERHEAD TEXT WATERMARK ════════════════════════════════ */}
      <text
        x="700" y="450"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="20"
        fontWeight="700"
        letterSpacing="12"
        fill={navy}
        fillOpacity="0.07"
        style={{ textTransform: "uppercase" }}
      >
        AUTOMYSTICS TECHNOLOGIES
      </text>
      <text
        x="700" y="474"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="11"
        fontWeight="400"
        letterSpacing="6"
        fill={navy}
        fillOpacity="0.05"
        style={{ textTransform: "uppercase" }}
      >
        Solar EPC Management Platform
      </text>
    </svg>
  );
}

export function Shell({ children }: ShellProps) {
  return (
    <div
      className="flex h-[100dvh] w-full overflow-hidden"
      style={{ background: "#F7F4ED" }}
    >
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden" style={{ position: "relative" }}>
        <Topbar />

        {/* ── Watermark: fixed inside the content column, behind everything ── */}
        <div
          style={{
            position : "absolute",
            top      : "56px",   // below topbar
            left     : 0,
            right    : 0,
            bottom   : 0,
            zIndex   : 0,
            overflow : "hidden",
            pointerEvents : "none",
          }}
        >
          <SolarWatermark />
        </div>

        {/* ── Page content ── */}
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
