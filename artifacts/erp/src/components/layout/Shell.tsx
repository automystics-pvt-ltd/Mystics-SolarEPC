import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface ShellProps {
  children: ReactNode;
}

/**
 * SolarHouseWatermark
 * Large, misty solar-house illustration — Solarix-style background motif.
 * A detailed architectural house SVG with pitched roof, solar panel rows,
 * windows, door, chimney and landscaping is masked with a soft radial fog
 * gradient so it dissolves into the warm cream background like a photographic
 * fade. Visible in every white-space gap between cards on all screens.
 */
function SolarHouseWatermark() {
  // ── Palette (sepia-amber, very low opacity) ──
  const wall   = "#b8935a";
  const roof   = "#7a5230";
  const panel  = "#4a5578";
  const glass  = "#7bb8d4";
  const trim   = "#8b6840";
  const ground = "#8a9a5b";
  const amber  = "#f59e0b";

  // ── House geometry ──
  const HX  = 55;   // left wall
  const HY  = 370;  // wall top
  const HW  = 520;  // wall width
  const HH  = 205;  // wall height
  const HCX = HX + HW / 2;           // 315
  const GROUND_Y = HY + HH;          // 575
  const EAVE_L = HX - 18;            // left eave
  const EAVE_R = HX + HW + 18;       // right eave
  const PEAK_Y  = 230;               // roof peak Y

  // ── Garage (right wing) ──
  const GX = HX + HW;
  const GY = HY + 60;
  const GW = 150;
  const GH = HH - 60;
  const EAVE_GR = GX + GW + 10;
  const PEAK_G  = GY - 60;

  // ── Solar panel helper on left roof face ──
  // Left slope: from (EAVE_L, HY) to (HCX, PEAK_Y)
  // We place a 6×2 grid of panels as parallelograms
  const slopeRun  = HCX - EAVE_L;      // 278
  const slopeRise = HY - PEAK_Y;       // 140
  const slopeLen  = Math.hypot(slopeRun, slopeRise);
  const ux = slopeRun  / slopeLen;     // unit along slope
  const uy = -slopeRise / slopeLen;    // (goes upward → negative Y)
  // perpendicular (pointing right along roof surface, downward)
  const px = -uy;
  const py =  ux;

  const PANEL_W = 42;  // along slope direction
  const PANEL_H = 28;  // perpendicular
  const P_GAP_W = 5;
  const P_GAP_H = 4;
  const P_COLS  = 5;
  const P_ROWS  = 2;

  // Anchor: start inset from eave, inset from peak
  const anchorX = EAVE_L + (slopeRun * 0.18);
  const anchorY = HY    - (slopeRise * 0.18);

  const solarPanels: JSX.Element[] = [];
  for (let r = 0; r < P_ROWS; r++) {
    for (let c = 0; c < P_COLS; c++) {
      const ox = c * (PANEL_W + P_GAP_W);
      const oy = r * (PANEL_H + P_GAP_H);
      // four corners of this panel in SVG coords
      const corners = [
        [anchorX + ox*ux + oy*px,           anchorY + ox*uy + oy*py],
        [anchorX + (ox+PANEL_W)*ux + oy*px, anchorY + (ox+PANEL_W)*uy + oy*py],
        [anchorX + (ox+PANEL_W)*ux + (oy+PANEL_H)*px, anchorY + (ox+PANEL_W)*uy + (oy+PANEL_H)*py],
        [anchorX + ox*ux + (oy+PANEL_H)*px, anchorY + ox*uy + (oy+PANEL_H)*py],
      ];
      const pts = corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
      // inner busbar lines
      const mid1 = [
        (corners[0][0]+corners[1][0])/2, (corners[0][1]+corners[1][1])/2,
        (corners[3][0]+corners[2][0])/2, (corners[3][1]+corners[2][1])/2,
      ];
      const mid2 = [
        (corners[0][0]+corners[3][0])/2, (corners[0][1]+corners[3][1])/2,
        (corners[1][0]+corners[2][0])/2, (corners[1][1]+corners[2][1])/2,
      ];
      solarPanels.push(
        <g key={`sp-${r}-${c}`}>
          <polygon points={pts} fill={panel} fillOpacity="0.18" stroke={panel} strokeWidth="1" strokeOpacity="0.22" />
          <line x1={mid1[0]} y1={mid1[1]} x2={mid1[2]} y2={mid1[3]} stroke={panel} strokeWidth="0.5" strokeOpacity="0.12" />
          <line x1={mid2[0]} y1={mid2[1]} x2={mid2[2]} y2={mid2[3]} stroke={panel} strokeWidth="0.5" strokeOpacity="0.12" />
        </g>
      );
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1400 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={{
        position     : "absolute",
        inset        : 0,
        width        : "100%",
        height       : "100%",
        pointerEvents: "none",
        userSelect   : "none",
      }}
    >
      <defs>
        {/* ── Fog mask — dissolves the house into the background ── */}
        <radialGradient id="fog" cx="32%" cy="62%" r="52%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="white" stopOpacity="1"   />
          <stop offset="55%"  stopColor="white" stopOpacity="0.8" />
          <stop offset="82%"  stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor="white" stopOpacity="0"   />
        </radialGradient>
        <mask id="house-fog">
          <rect width="1400" height="800" fill="url(#fog)" />
        </mask>

        {/* ── Sun warm glow ── */}
        <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={amber} stopOpacity="0.28" />
          <stop offset="45%"  stopColor={amber} stopOpacity="0.10" />
          <stop offset="100%" stopColor={amber} stopOpacity="0"    />
        </radialGradient>

        {/* ── Sky gradient behind house ── */}
        <radialGradient id="sky-haze" cx="30%" cy="40%" r="60%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#fef3c7" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fef3c7" stopOpacity="0"    />
        </radialGradient>

        {/* ── Ground gradient ── */}
        <linearGradient id="ground-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={ground} stopOpacity="0.18" />
          <stop offset="100%" stopColor={ground} stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* ══ SKY HAZE ══════════════════════════════════════════════════ */}
      <rect width="1400" height="800" fill="url(#sky-haze)" />

      {/* ══ SUN ══════════════════════════════════════════════════════ */}
      <g mask="url(#house-fog)">
        {/* Glow halo */}
        <circle cx="280" cy="195" r="220" fill="url(#sun-glow)" />
        {/* Sun disc */}
        <circle cx="280" cy="195" r="68"  fill={amber} fillOpacity="0.13" />
        <circle cx="280" cy="195" r="50"  fill={amber} fillOpacity="0.10" />
        {/* Rays */}
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i * (360/14) * Math.PI) / 180;
          const long = i % 2 === 0;
          return (
            <line key={i}
              x1={280 + Math.cos(a)*76}  y1={195 + Math.sin(a)*76}
              x2={280 + Math.cos(a)*(long ? 108 : 94)} y2={195 + Math.sin(a)*(long ? 108 : 94)}
              stroke={amber} strokeWidth={long ? 3.5 : 2}
              strokeLinecap="round" strokeOpacity={long ? 0.18 : 0.11}
            />
          );
        })}
      </g>

      {/* ══ FULL HOUSE GROUP — masked with fog ════════════════════════ */}
      <g mask="url(#house-fog)">

        {/* ── Ground / lawn ── */}
        <ellipse cx={HX + HW*0.4} cy={GROUND_Y + 18} rx={HW*0.7} ry={32}
          fill="url(#ground-grad)" />
        <rect x={HX - 30} y={GROUND_Y} width={HW + GW + 60} height={8}
          fill={ground} fillOpacity="0.12" rx="4" />

        {/* ── Small bush left ── */}
        <ellipse cx={HX - 8} cy={GROUND_Y - 5}  rx="28" ry="20" fill={ground} fillOpacity="0.13" />
        <ellipse cx={HX + 5} cy={GROUND_Y - 16} rx="18" ry="24" fill={ground} fillOpacity="0.10" />

        {/* ── Tree (right of garage) ── */}
        <ellipse cx={GX + GW + 55} cy={GROUND_Y - 50} rx="30" ry="52" fill={ground} fillOpacity="0.11" />
        <rect    x={GX + GW + 50} y={GROUND_Y - 10} width="8" height="18" fill={trim} fillOpacity="0.10" rx="2" />

        {/* ── Garage (right wing) ── */}
        {/* Garage wall */}
        <rect x={GX} y={GY} width={GW} height={GH}
          fill={wall} fillOpacity="0.10" stroke={trim} strokeWidth="1.2" strokeOpacity="0.12" />
        {/* Garage roof */}
        <polygon points={`${GX-8},${GY}  ${GX+GW/2},${PEAK_G}  ${EAVE_GR},${GY}`}
          fill={roof} fillOpacity="0.13" stroke={trim} strokeWidth="1.2" strokeOpacity="0.12" />
        {/* Garage door */}
        <rect x={GX + 20} y={GY + 55} width={GW - 40} height={GH - 65}
          fill={trim} fillOpacity="0.10" stroke={trim} strokeWidth="1" strokeOpacity="0.14" rx="2" />
        {/* Garage door panels */}
        {[0,1,2,3].map(i => (
          <line key={i} x1={GX+20} y1={GY+55+i*14} x2={GX+GW-20} y2={GY+55+i*14}
            stroke={trim} strokeWidth="0.8" strokeOpacity="0.10" />
        ))}

        {/* ── Main house walls ── */}
        <rect x={HX} y={HY} width={HW} height={HH}
          fill={wall} fillOpacity="0.11" stroke={trim} strokeWidth="1.5" strokeOpacity="0.13" />

        {/* ── Main roof ── */}
        <polygon
          points={`${EAVE_L},${HY}  ${HCX},${PEAK_Y}  ${EAVE_R},${HY}`}
          fill={roof} fillOpacity="0.14"
          stroke={trim} strokeWidth="1.5" strokeOpacity="0.14"
        />
        {/* Roof ridge cap */}
        <line x1={HCX - 5} y1={PEAK_Y + 2} x2={HCX + 5} y2={PEAK_Y + 2}
          stroke={trim} strokeWidth="4" strokeLinecap="round" strokeOpacity="0.12" />

        {/* ── Solar panels on left roof slope ── */}
        {solarPanels}

        {/* ── Chimney ── */}
        <rect x={HCX + 60} y={PEAK_Y - 40} width={28} height={60}
          fill={roof} fillOpacity="0.16" stroke={trim} strokeWidth="1.2" strokeOpacity="0.14" />
        <rect x={HCX + 56} y={PEAK_Y - 44} width={36} height={8}
          fill={roof} fillOpacity="0.18" stroke={trim} strokeWidth="1" strokeOpacity="0.12" rx="1" />

        {/* ── Front door ── */}
        <rect x={HCX - 28} y={HY + HH - 90} width={56} height={90}
          fill={trim} fillOpacity="0.12"
          stroke={trim} strokeWidth="1.5" strokeOpacity="0.16" rx="2" />
        {/* Door arch */}
        <path
          d={`M ${HCX-28},${HY+HH-90} Q ${HCX},${HY+HH-116} ${HCX+28},${HY+HH-90}`}
          fill="none" stroke={trim} strokeWidth="1.2" strokeOpacity="0.14"
        />
        {/* Door handle */}
        <circle cx={HCX + 16} cy={HY + HH - 48} r="4"
          fill={amber} fillOpacity="0.16" />

        {/* ── Windows left ── */}
        <rect x={HX + 50} y={HY + 45} width={80} height={65}
          fill={glass} fillOpacity="0.14"
          stroke={trim} strokeWidth="1.5" strokeOpacity="0.14" rx="2" />
        {/* Window cross */}
        <line x1={HX+90} y1={HY+45} x2={HX+90} y2={HY+110}
          stroke={trim} strokeWidth="1" strokeOpacity="0.12" />
        <line x1={HX+50} y1={HY+77} x2={HX+130} y2={HY+77}
          stroke={trim} strokeWidth="1" strokeOpacity="0.12" />

        {/* ── Windows right ── */}
        <rect x={HX + HW - 150} y={HY + 45} width={80} height={65}
          fill={glass} fillOpacity="0.14"
          stroke={trim} strokeWidth="1.5" strokeOpacity="0.14" rx="2" />
        <line x1={HX+HW-110} y1={HY+45} x2={HX+HW-110} y2={HY+110}
          stroke={trim} strokeWidth="1" strokeOpacity="0.12" />
        <line x1={HX+HW-150} y1={HY+77} x2={HX+HW-70} y2={HY+77}
          stroke={trim} strokeWidth="1" strokeOpacity="0.12" />

        {/* ── Small upper window ── */}
        <rect x={HCX - 22} y={HY + 30} width={44} height={36}
          fill={glass} fillOpacity="0.12"
          stroke={trim} strokeWidth="1" strokeOpacity="0.12" rx="2" />

        {/* ── Walkway ── */}
        <path
          d={`M ${HCX - 20},${GROUND_Y} L ${HCX - 30},${GROUND_Y + 22}
              L ${HCX + 30},${GROUND_Y + 22} L ${HCX + 20},${GROUND_Y}`}
          fill={trim} fillOpacity="0.08"
        />
      </g>

      {/* ══ COMPANY LETTERMARK (far right, open area) ═══════════════════ */}
      <text
        x="1060" y="220"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="15"
        fontWeight="700"
        letterSpacing="10"
        fill="#0c1445"
        fillOpacity="0.055"
      >
        MYSTICS ERP
      </text>
      <text
        x="1060" y="240"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="9"
        fontWeight="400"
        letterSpacing="5"
        fill="#0c1445"
        fillOpacity="0.04"
      >
        ERP &amp; PROJECT MANAGEMENT
      </text>
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

        {/* ── Watermark sits below topbar, covers entire content column ── */}
        <div
          style={{
            position     : "absolute",
            top          : "56px",
            left         : 0,
            right        : 0,
            bottom       : 0,
            zIndex       : 0,
            overflow     : "hidden",
            pointerEvents: "none",
          }}
        >
          <SolarHouseWatermark />
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
