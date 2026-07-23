import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background print:block print:h-auto">
      {/* Sidebar — desktop only (hidden via CSS on mobile) */}
      <div className="print:hidden">
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:block">
        {/* Sticky topbar */}
        <div className="print:hidden shrink-0">
          <Topbar />
        </div>

        {/* Scrollable page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto scrollbar-thin print:overflow-visible"
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 print:px-0 print:py-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
