import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden" style={{ background: "#FFFBF0" }}>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        {/* Solar panel grid background */}
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{
            backgroundImage: `
              linear-gradient(rgba(234,88,12,0.035) 1px, transparent 1px),
              linear-gradient(90deg, rgba(234,88,12,0.035) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
            backgroundColor: "#FFFBF0",
          }}
        >
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
