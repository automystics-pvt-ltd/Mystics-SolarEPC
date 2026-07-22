import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div
      className="flex h-[100dvh] w-full overflow-hidden bg-[#FAFAFA] print:block print:h-auto print:overflow-visible"
    >
      <div className="print:hidden"><Sidebar /></div>
      <div className="flex flex-1 flex-col overflow-hidden relative print:block print:overflow-visible">
        <div className="print:hidden"><Topbar /></div>
        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 w-full print:overflow-visible print:p-6"
        >
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
