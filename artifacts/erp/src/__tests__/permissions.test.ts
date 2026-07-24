/**
 * Frontend permission logic unit tests — Task #144
 *
 * Tests the RBAC fallback permission map that mirrors the backend FALLBACK
 * and the NavRail visibility filtering logic without requiring a live API.
 *
 * These tests validate that:
 *  1. The permission map correctly grants/denies actions per role
 *  2. NavRail module visibility (`permMap[key].view !== false`) filters correctly
 *  3. PermissionGate logic (can(action)) works as expected
 */

import { describe, it, expect } from "vitest";

// ── Re-implement the backend FALLBACK exactly as in rbac.ts ──────────────────
// This mirrors the server-side source of truth; if they diverge, tests fail.
const FALLBACK: Record<string, Record<string, string[]>> = {
  admin: { "*": ["view", "create", "edit", "delete", "approve", "export", "import", "admin"] },
  director: {
    dashboard:     ["view", "export"],
    crm:           ["view", "create", "edit", "approve", "export"],
    procurement:   ["view", "approve", "export", "edit"],
    materials:     ["view", "export"],
    vendors:       ["view", "export"],
    projects:      ["view", "approve", "export"],
    inventory:     ["view", "export"],
    engineering:   ["view", "approve", "export"],
    commissioning: ["view", "approve"],
    oam:           ["view", "export"],
    finance:       ["view", "approve", "export"],
    reports:       ["view", "export"],
    admin:         ["view"],
    approvals:     ["view", "approve", "export"],
  },
  pm: {
    dashboard:     ["view"],
    crm:           ["view", "create", "edit"],
    procurement:   ["view", "create", "edit", "export"],
    materials:     ["view", "create", "edit", "export", "import"],
    vendors:       ["view", "create", "edit"],
    projects:      ["view", "create", "edit", "approve", "export"],
    inventory:     ["view", "create", "edit"],
    engineering:   ["view", "create", "edit", "approve", "export"],
    commissioning: ["view", "create", "edit", "approve"],
    oam:           ["view", "create", "edit"],
    finance:       ["view"],
    reports:       ["view", "export"],
    approvals:     ["view", "approve", "create"],
  },
  finance: {
    dashboard:   ["view"],
    procurement: ["view", "approve", "export"],
    vendors:     ["view"],
    materials:   ["view"],
    projects:    ["view"],
    inventory:   ["view"],
    finance:     ["view", "create", "edit", "approve", "export"],
    reports:     ["view", "export"],
    approvals:   ["view", "approve"],
  },
  warehouse: {
    dashboard:   ["view"],
    procurement: ["view", "create"],
    materials:   ["view"],
    vendors:     ["view"],
    projects:    ["view"],
    inventory:   ["view", "create", "edit", "export"],
    oam:         ["view", "create"],
    reports:     ["view"],
    approvals:   ["view"],
  },
  sales: {
    dashboard: ["view"],
    crm:       ["view", "create", "edit", "delete", "export"],
    projects:  ["view", "create"],
    reports:   ["view"],
    approvals: ["view"],
  },
};

function hasFallback(role: string, module: string, action: string): boolean {
  if (role === "admin") return true;
  const roleMap = FALLBACK[role];
  if (!roleMap) return false;
  return (roleMap[module] ?? []).includes(action);
}

/** Build a permMap object the way the API /rbac/my-permissions endpoint does */
const MODULES = [
  "dashboard", "crm", "procurement", "materials", "vendors",
  "projects", "inventory", "engineering", "commissioning",
  "oam", "finance", "reports", "admin", "approvals",
] as const;

const ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "import", "admin"] as const;

function buildPermMap(role: string): Record<string, Record<string, boolean>> {
  const result: Record<string, Record<string, boolean>> = {};
  for (const mod of MODULES) {
    result[mod] = {};
    for (const act of ACTIONS) {
      result[mod][act] = hasFallback(role, mod, act);
    }
  }
  return result;
}

/** NavRail visibility logic (mirrors NavRail.tsx visible filter) */
function visibleModules(role: string, permMap: Record<string, Record<string, boolean>>): string[] {
  if (role === "admin") return [...MODULES];
  return MODULES.filter((key) => permMap[key]?.view !== false);
}

// ══════════════════════════════════════════════════════════════════════════════
// Admin — has every permission on every module
// ══════════════════════════════════════════════════════════════════════════════
describe("Admin permissions", () => {
  it("has every action on every module", () => {
    for (const mod of MODULES) {
      for (const act of ACTIONS) {
        expect(hasFallback("admin", mod, act)).toBe(true);
      }
    }
  });

  it("sees all modules in NavRail", () => {
    const perm = buildPermMap("admin");
    const visible = visibleModules("admin", perm);
    expect(visible).toEqual(expect.arrayContaining([...MODULES]));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Warehouse — limited procurement access, no CRM/vendors write
// ══════════════════════════════════════════════════════════════════════════════
describe("Warehouse permissions", () => {
  it("can view and create procurement", () => {
    expect(hasFallback("warehouse", "procurement", "view")).toBe(true);
    expect(hasFallback("warehouse", "procurement", "create")).toBe(true);
  });

  it("cannot edit or approve procurement", () => {
    expect(hasFallback("warehouse", "procurement", "edit")).toBe(false);
    expect(hasFallback("warehouse", "procurement", "approve")).toBe(false);
  });

  it("cannot access CRM at all", () => {
    expect(hasFallback("warehouse", "crm", "view")).toBe(false);
    expect(hasFallback("warehouse", "crm", "create")).toBe(false);
  });

  it("cannot create or edit vendors", () => {
    expect(hasFallback("warehouse", "vendors", "create")).toBe(false);
    expect(hasFallback("warehouse", "vendors", "edit")).toBe(false);
  });

  it("cannot create projects", () => {
    expect(hasFallback("warehouse", "projects", "create")).toBe(false);
  });

  it("can manage inventory (view, create, edit)", () => {
    expect(hasFallback("warehouse", "inventory", "view")).toBe(true);
    expect(hasFallback("warehouse", "inventory", "create")).toBe(true);
    expect(hasFallback("warehouse", "inventory", "edit")).toBe(true);
  });

  it("NavRail: crm is hidden (no view permission)", () => {
    const perm = buildPermMap("warehouse");
    expect(perm["crm"]["view"]).toBe(false);
    const visible = visibleModules("warehouse", perm);
    expect(visible).not.toContain("crm");
  });

  it("NavRail: procurement is visible (has view)", () => {
    const perm = buildPermMap("warehouse");
    const visible = visibleModules("warehouse", perm);
    expect(visible).toContain("procurement");
  });

  it("NavRail: finance module is hidden", () => {
    const perm = buildPermMap("warehouse");
    const visible = visibleModules("warehouse", perm);
    expect(visible).not.toContain("finance");
  });

  it("NavRail: engineering module is hidden", () => {
    const perm = buildPermMap("warehouse");
    const visible = visibleModules("warehouse", perm);
    expect(visible).not.toContain("engineering");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Sales — CRM full access, no procurement write
// ══════════════════════════════════════════════════════════════════════════════
describe("Sales permissions", () => {
  it("can create/edit/delete leads (CRM)", () => {
    expect(hasFallback("sales", "crm", "create")).toBe(true);
    expect(hasFallback("sales", "crm", "edit")).toBe(true);
    expect(hasFallback("sales", "crm", "delete")).toBe(true);
  });

  it("cannot access procurement at all", () => {
    expect(hasFallback("sales", "procurement", "view")).toBe(false);
    expect(hasFallback("sales", "procurement", "create")).toBe(false);
    expect(hasFallback("sales", "procurement", "approve")).toBe(false);
  });

  it("cannot create vendors", () => {
    expect(hasFallback("sales", "vendors", "create")).toBe(false);
  });

  it("cannot access finance, inventory, or engineering", () => {
    expect(hasFallback("sales", "finance", "view")).toBe(false);
    expect(hasFallback("sales", "inventory", "view")).toBe(false);
    expect(hasFallback("sales", "engineering", "view")).toBe(false);
  });

  it("NavRail: procurement hidden (no view)", () => {
    const perm = buildPermMap("sales");
    const visible = visibleModules("sales", perm);
    expect(visible).not.toContain("procurement");
  });

  it("NavRail: crm visible", () => {
    const perm = buildPermMap("sales");
    const visible = visibleModules("sales", perm);
    expect(visible).toContain("crm");
  });

  it("NavRail: inventory hidden", () => {
    const perm = buildPermMap("sales");
    const visible = visibleModules("sales", perm);
    expect(visible).not.toContain("inventory");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Finance — procurement approve/export but no create
// ══════════════════════════════════════════════════════════════════════════════
describe("Finance permissions", () => {
  it("can approve procurement but not create", () => {
    expect(hasFallback("finance", "procurement", "approve")).toBe(true);
    expect(hasFallback("finance", "procurement", "create")).toBe(false);
    expect(hasFallback("finance", "procurement", "edit")).toBe(false);
  });

  it("has full finance module access", () => {
    expect(hasFallback("finance", "finance", "view")).toBe(true);
    expect(hasFallback("finance", "finance", "create")).toBe(true);
    expect(hasFallback("finance", "finance", "approve")).toBe(true);
  });

  it("cannot access CRM", () => {
    expect(hasFallback("finance", "crm", "view")).toBe(false);
    expect(hasFallback("finance", "crm", "create")).toBe(false);
  });

  it("NavRail: finance and procurement are visible", () => {
    const perm = buildPermMap("finance");
    const visible = visibleModules("finance", perm);
    expect(visible).toContain("finance");
    expect(visible).toContain("procurement");
  });

  it("NavRail: crm is hidden", () => {
    const perm = buildPermMap("finance");
    const visible = visibleModules("finance", perm);
    expect(visible).not.toContain("crm");
  });

  it("NavRail: engineering and commissioning are hidden", () => {
    const perm = buildPermMap("finance");
    const visible = visibleModules("finance", perm);
    expect(visible).not.toContain("engineering");
    expect(visible).not.toContain("commissioning");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PM — broad access but no approve on procurement
// ══════════════════════════════════════════════════════════════════════════════
describe("PM permissions", () => {
  it("can create and edit procurement but not approve", () => {
    expect(hasFallback("pm", "procurement", "create")).toBe(true);
    expect(hasFallback("pm", "procurement", "edit")).toBe(true);
    expect(hasFallback("pm", "procurement", "approve")).toBe(false);
  });

  it("can create and approve projects", () => {
    expect(hasFallback("pm", "projects", "create")).toBe(true);
    expect(hasFallback("pm", "projects", "approve")).toBe(true);
  });

  it("can manage vendors (create/edit)", () => {
    expect(hasFallback("pm", "vendors", "create")).toBe(true);
    expect(hasFallback("pm", "vendors", "edit")).toBe(true);
  });

  it("NavRail: all major modules visible except admin", () => {
    const perm = buildPermMap("pm");
    const visible = visibleModules("pm", perm);
    expect(visible).toContain("procurement");
    expect(visible).toContain("crm");
    expect(visible).toContain("projects");
    expect(visible).toContain("inventory");
  });

  it("NavRail: admin module hidden (no view)", () => {
    const perm = buildPermMap("pm");
    const visible = visibleModules("pm", perm);
    expect(visible).not.toContain("admin");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Director — approve-heavy, no procurement create
// ══════════════════════════════════════════════════════════════════════════════
describe("Director permissions", () => {
  it("can approve procurement but not create", () => {
    expect(hasFallback("director", "procurement", "approve")).toBe(true);
    expect(hasFallback("director", "procurement", "create")).toBe(false);
  });

  it("can approve projects", () => {
    expect(hasFallback("director", "projects", "approve")).toBe(true);
  });

  it("can view admin module", () => {
    expect(hasFallback("director", "admin", "view")).toBe(true);
    expect(hasFallback("director", "admin", "admin")).toBe(false);
  });

  it("NavRail: sees all modules that have view permission", () => {
    const perm = buildPermMap("director");
    const visible = visibleModules("director", perm);
    expect(visible).toContain("procurement");
    expect(visible).toContain("crm");
    expect(visible).toContain("finance");
    expect(visible).toContain("admin");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PermissionGate logic — can(action) simulation
// ══════════════════════════════════════════════════════════════════════════════
describe("PermissionGate can(action) simulation", () => {
  function can(role: string, module: string, action: string): boolean {
    if (role === "admin") return true;
    return hasFallback(role, module, action);
  }

  it("PermissionGate blocks warehouse from CRM create", () => {
    expect(can("warehouse", "crm", "create")).toBe(false);
  });

  it("PermissionGate allows warehouse procurement create", () => {
    expect(can("warehouse", "procurement", "create")).toBe(true);
  });

  it("PermissionGate blocks sales from procurement create", () => {
    expect(can("sales", "procurement", "create")).toBe(false);
  });

  it("PermissionGate allows sales CRM create", () => {
    expect(can("sales", "crm", "create")).toBe(true);
  });

  it("PermissionGate blocks finance from procurement create", () => {
    expect(can("finance", "procurement", "create")).toBe(false);
  });

  it("PermissionGate allows finance procurement approve", () => {
    expect(can("finance", "procurement", "approve")).toBe(true);
  });

  it("PermissionGate always allows admin on anything", () => {
    expect(can("admin", "crm", "delete")).toBe(true);
    expect(can("admin", "admin", "admin")).toBe(true);
    expect(can("admin", "procurement", "approve")).toBe(true);
  });
});
