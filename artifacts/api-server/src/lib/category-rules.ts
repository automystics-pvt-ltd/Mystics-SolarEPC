/**
 * Single source of truth for procurement category classification.
 * Used by both the dashboard aggregation and the PO list filter endpoint.
 */

export const OTHER_CATEGORY = "Other";

/** Named categories with their regex (for material name matching) and SQL LIKE patterns */
export const CATEGORY_DEFS: Array<{
  label: string;
  pattern: RegExp;
  likePatterns: string[];
}> = [
  {
    label: "Solar Modules",
    pattern: /solar|panel|module|pv\b/i,
    likePatterns: ["%solar%", "%panel%", "%module%", "%pv %", "%pv\t%"],
  },
  {
    label: "Inverters",
    pattern: /inverter|invertor/i,
    likePatterns: ["%inverter%", "%invertor%"],
  },
  {
    label: "Cables & Wiring",
    pattern: /cable|wire|wiring|conductor|lv\s*cable/i,
    likePatterns: ["%cable%", "%wire%", "%wiring%", "%conductor%"],
  },
  {
    label: "Mounting Structure",
    pattern: /structure|mounting|frame|rail|rack|racking/i,
    likePatterns: ["%structure%", "%mounting%", "%frame%", "%rail%", "%rack%"],
  },
  {
    label: "Switchgear",
    pattern: /switch|breaker|mcb|mccb|fuse|rmu|acdb|dcdb/i,
    likePatterns: ["%switch%", "%breaker%", "%mcb%", "%mccb%", "%fuse%", "%rmu%", "%acdb%", "%dcdb%"],
  },
  {
    label: "Transformers",
    pattern: /transformer|trafo/i,
    likePatterns: ["%transformer%", "%trafo%"],
  },
  {
    label: "Energy Storage",
    pattern: /battery|storage|bess/i,
    likePatterns: ["%battery%", "%storage%", "%bess%"],
  },
  {
    label: "Monitoring & Metering",
    pattern: /meter|monitor|scada|sensor/i,
    likePatterns: ["%meter%", "%monitor%", "%scada%", "%sensor%"],
  },
  {
    label: "Conduit & Trays",
    pattern: /conduit|tray|trunking|pipe/i,
    likePatterns: ["%conduit%", "%tray%", "%trunking%", "%pipe%"],
  },
];

/** Derive a category label from a material name string */
export function deriveCategory(materialName: string): string {
  for (const def of CATEGORY_DEFS) {
    if (def.pattern.test(materialName)) return def.label;
  }
  return OTHER_CATEGORY;
}
