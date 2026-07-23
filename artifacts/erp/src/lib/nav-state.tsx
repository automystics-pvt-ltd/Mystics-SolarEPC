import { createContext, useContext, useState, ReactNode } from "react";

interface NavStateValue {
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
}

const NavStateCtx = createContext<NavStateValue>({ navOpen: false, setNavOpen: () => {} });

export function NavStateProvider({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  return <NavStateCtx.Provider value={{ navOpen, setNavOpen }}>{children}</NavStateCtx.Provider>;
}

export function useNavState() {
  return useContext(NavStateCtx);
}
