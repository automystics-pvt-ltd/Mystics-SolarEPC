import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface ShellProps {
  children: ReactNode;
}

// Watermark SVG — solar panel array + sun, ghosted behind content
function SolarWatermark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 900 700"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.045,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* ── Sun ── */}
      <g transform="translate(720, 140)">
        {/* Sun core */}
        <circle cx="0" cy="0" r="52" fill="#d97706" />
        {/* Sun rays */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x1 = Math.cos(angle) * 64;
          const y1 = Math.sin(angle) * 64;
          const x2 = Math.cos(angle) * 88;
          const y2 = Math.sin(angle) * 88;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#d97706"
              strokeWidth={i % 3 === 0 ? 5 : 3}
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* ── Solar Panel Array — 3 rows × 6 cols ── */}
      {/* Row 1 */}
      {Array.from({ length: 6 }).map((_, col) =>
        Array.from({ length: 3 }).map((_, row) => {
          const x = 80 + col * 110;
          const y = 340 + row * 68;
          return (
            <g key={`${col}-${row}`} transform={`translate(${x}, ${y})`}>
              {/* Panel frame */}
              <rect x="0" y="0" width="96" height="58" rx="3" fill="none" stroke="#0c1445" strokeWidth="2.5" />
              {/* Panel cells grid — 3×4 */}
              {Array.from({ length: 3 }).map((_, r) =>
                Array.from({ length: 4 }).map((_, c) => (
                  <rect
                    key={`${r}-${c}`}
                    x={4 + c * 22}
                    y={4 + r * 17}
                    width="19"
                    height="14"
                    rx="1"
                    fill="#0c1445"
                    fillOpacity="0.55"
                  />
                ))
              )}
              {/* Busbars */}
              <line x1="48" y1="4" x2="48" y2="54" stroke="#0c1445" strokeWidth="1" strokeOpacity="0.4" />
              <line x1="4" y1="29" x2="92" y2="29" stroke="#0c1445" strokeWidth="1" strokeOpacity="0.4" />
            </g>
          );
        })
      )}

      {/* ── Mounting rail lines ── */}
      {Array.from({ length: 3 }).map((_, row) => (
        <line
          key={row}
          x1="70"
          y1={369 + row * 68}
          x2="770"
          y2={369 + row * 68}
          stroke="#0c1445"
          strokeWidth="3"
          strokeOpacity="0.25"
        />
      ))}

      {/* ── Soft radial glow behind sun ── */}
      <defs>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="140" rx="130" ry="130" fill="url(#sunGlow)" opacity="0.35" />

      {/* ── Company name watermark (very subtle) ── */}
      <text
        x="450"
        y="280"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="26"
        fontWeight="700"
        letterSpacing="8"
        fill="#0c1445"
        fillOpacity="0.18"
        style={{ textTransform: "uppercase" }}
      >
        AUTOMYSTICS
      </text>
    </svg>
  );
}

export function Shell({ children }: ShellProps) {
  return (
    <div
      className="flex h-[100dvh] w-full overflow-hidden"
      style={{ background: "#F9F6EE" }}
    >
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ position: "relative", backgroundColor: "#F9F6EE" }}
        >
          {/* Watermark layer — behind content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            <SolarWatermark />
          </div>

          {/* Page content — above watermark */}
          <div className="mx-auto max-w-7xl" style={{ position: "relative", zIndex: 1 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
