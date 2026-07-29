import { format } from "date-fns";
import { PrintDocumentLayout, PrintSection, MetaGrid, TotalsBlock, tbl } from "../PrintDocumentLayout";

function fmtINR(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(2)} Cr`;
  if (v >= 100_000)    return `₹${(v / 100_000).toFixed(2)} L`;
  return `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
}

export function QuotationPrint({
  quote, boqItems, leadName, markupPct,
}: {
  quote: any;
  boqItems: any[];
  leadName?: string;
  markupPct: number;
}) {
  const DEFAULT_GST = 18;

  /* Compute totals */
  const baseSubtotal = boqItems.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice ?? i.unitRate) || 0), 0);
  const markupAmount = baseSubtotal * (markupPct / 100);
  const preGstTotal  = baseSubtotal + markupAmount;
  const totalGst     = boqItems.reduce((s, i) => {
    const base = (Number(i.qty) || 0) * (Number(i.unitPrice ?? i.unitRate) || 0);
    const gst  = Number(i.gstPct ?? DEFAULT_GST) / 100;
    return s + base * gst * (1 + markupPct / 100);
  }, 0);
  const grandTotal = preGstTotal + totalGst;

  const docNumber = `QTN-${String(quote?.id ?? 0).padStart(4, "0")}`;

  return (
    <PrintDocumentLayout
      docType="Quotation"
      docNumber={docNumber}
      docStatus={quote?.status}
    >
      {/* Client info */}
      <div style={{
        padding: "12px 16px", background: "#fdf4ff", border: "1px solid #e9d5ff",
        borderRadius: 8, marginBottom: 20,
      }}>
        <p style={{ fontSize: 9, color: "#7c3aed", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Prepared For
        </p>
        <p style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginTop: 4 }}>
          {leadName ?? `Lead LD-${String(quote?.leadId ?? 0).padStart(4, "0")}`}
        </p>
      </div>

      {/* Meta */}
      <PrintSection title="Quotation Details">
        <MetaGrid rows={[
          [
            { label: "Version",        value: quote?.version ? `Version ${quote.version}` : "Draft" },
            { label: "Valid Until",    value: fmtDate(quote?.validTill) },
          ],
          [
            { label: "Markup / Margin",value: `${markupPct}%` },
            { label: "Prepared By",    value: quote?.createdByName },
          ],
          [
            { label: "Created",        value: fmtDate(quote?.createdAt) },
            { label: "Client PO #",    value: quote?.clientPoNumber, mono: true },
          ],
        ]} />
      </PrintSection>

      {/* BOQ items */}
      <PrintSection title={`Bill of Quantities (${boqItems.length} items)`}>
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}   style={{ width: 28 }}>#</th>
              <th className={tbl.th}>Description</th>
              <th className={tbl.thC} style={{ width: 48 }}>UOM</th>
              <th className={tbl.thR} style={{ width: 52 }}>Qty</th>
              <th className={tbl.thR} style={{ width: 84 }}>Unit Rate</th>
              <th className={tbl.thC} style={{ width: 44 }}>GST%</th>
              <th className={tbl.thR} style={{ width: 88 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {boqItems.map((item, i) => {
              const qty       = Number(item.qty)   || 0;
              const unitPrice = Number(item.unitPrice ?? item.unitRate) || 0;
              const gstPct    = Number(item.gstPct ?? DEFAULT_GST);
              const lineBase  = qty * unitPrice * (1 + markupPct / 100);
              const lineGst   = lineBase * (gstPct / 100);
              const lineTotal = lineBase + lineGst;

              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td className={tbl.td}     style={{ color: "#9ca3af" }}>{i + 1}</td>
                  <td className={tbl.td}     style={{ fontWeight: 600 }}>{item.description ?? item.name ?? "—"}</td>
                  <td className={tbl.tdC}>{item.unit ?? item.uom ?? "NOS"}</td>
                  <td className={tbl.tdR}>{qty.toLocaleString()}</td>
                  <td className={tbl.tdR}>{fmtINR(unitPrice)}</td>
                  <td className={tbl.tdC}>{gstPct}%</td>
                  <td className={tbl.tdR}  style={{ fontWeight: 600 }}>{fmtINR(lineTotal)}</td>
                </tr>
              );
            })}
            {boqItems.length === 0 && (
              <tr>
                <td colSpan={7} className={tbl.td} style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>
                  No BOQ items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PrintSection>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <TotalsBlock rows={[
          { label: `Base Subtotal`,               value: fmtINR(baseSubtotal) },
          { label: `Markup (${markupPct}%)`,       value: fmtINR(markupAmount) },
          { label: "Pre-GST Total",               value: fmtINR(preGstTotal), separator: true },
          { label: "Total GST",                   value: fmtINR(totalGst) },
          { label: "Grand Total (incl. GST)",     value: fmtINR(grandTotal), bold: true, separator: true },
        ]} />
      </div>

      {/* Notes */}
      <PrintSection title="Notes & Validity">
        <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.7 }}>
          <p>1. This quotation is valid until {fmtDate(quote?.validTill)} from the date of issue.</p>
          <p>2. Prices are subject to revision based on material market fluctuations beyond ±5%.</p>
          <p>3. Delivery timeline will be confirmed upon receipt of purchase order.</p>
          <p>4. Payment terms: 30% advance, 60% on delivery, 10% on commissioning.</p>
          <p>5. GST as applicable at the time of invoicing shall be charged additionally.</p>
        </div>
      </PrintSection>

      {/* Signature */}
      <div style={{ display: "flex", gap: 48, marginTop: 32 }}>
        {["Prepared By", "Verified By", "Authorised Signatory"].map(label => (
          <div key={label} style={{ flex: 1, borderTop: "1px solid #d1d5db", paddingTop: 8 }}>
            <p style={{ fontSize: 9, color: "#9ca3af" }}>{label}</p>
          </div>
        ))}
      </div>
    </PrintDocumentLayout>
  );
}
