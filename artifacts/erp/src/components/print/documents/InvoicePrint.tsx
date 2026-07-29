import { format } from "date-fns";
import { PrintDocumentLayout, PrintSection, MetaGrid, TotalsBlock, tbl } from "../PrintDocumentLayout";

function fmtINR(v: number | null | undefined) {
  if (v == null) return "—";
  return `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
}

const MATCH_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  Matched:         { label: "Matched",   color: "#166534", bg: "#dcfce7" },
  MismatchPending: { label: "Mismatch",  color: "#991b1b", bg: "#fee2e2" },
  Approved:        { label: "Approved",  color: "#1d4ed8", bg: "#dbeafe" },
};

export function InvoicePrint({ invoice }: { invoice: any }) {
  const inv   = invoice;
  const items: any[] = inv.items ?? [];

  const subtotal     = Number(inv.subtotal    ?? 0);
  const gstAmount    = Number(inv.gstAmount   ?? inv.totalGst ?? 0);
  const freightAmt   = Number(inv.freightAmount ?? 0);
  const tdsAmount    = Number(inv.tdsAmount   ?? 0);
  const netPayable   = Number(inv.netPayable  ?? (subtotal + gstAmount + freightAmt - tdsAmount));

  const totalsRows = [
    { label: "Subtotal (excl. GST)", value: fmtINR(subtotal) },
    { label: "GST Amount",           value: fmtINR(gstAmount) },
    ...(freightAmt ? [{ label: "Freight / Charges", value: fmtINR(freightAmt) }] : []),
    ...(tdsAmount  ? [{ label: "TDS Deduction",     value: `-${fmtINR(tdsAmount)}` }] : []),
    { label: "Net Payable",          value: fmtINR(netPayable), bold: true, separator: true },
  ];

  const matchInfo = MATCH_STYLE[inv.matchStatus ?? ""] ?? null;

  return (
    <PrintDocumentLayout
      docType="Vendor Invoice"
      docNumber={inv.invoiceNumber ?? `INV-${inv.id}`}
      docStatus={inv.status}
    >
      {/* Match status banner */}
      {matchInfo && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
          borderRadius: 8, marginBottom: 20,
          background: matchInfo.bg, border: `1px solid ${matchInfo.color}33`,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: matchInfo.color }}>
            3-Way Match: {matchInfo.label}
          </span>
          {inv.mismatchDetails && (
            <span style={{ fontSize: 9, color: matchInfo.color }}>· {inv.mismatchDetails}</span>
          )}
        </div>
      )}

      {/* Meta */}
      <PrintSection title="Invoice Details">
        <MetaGrid rows={[
          [
            { label: "Vendor",         value: inv.vendorName },
            { label: "Invoice Date",   value: fmtDate(inv.invoiceDate) },
          ],
          [
            { label: "PO Reference",   value: inv.poNumber,  mono: true },
            { label: "Due Date",       value: fmtDate(inv.dueDate) },
          ],
          [
            { label: "GRN Reference",  value: inv.grnNumber, mono: true },
            { label: "Created",        value: fmtDate(inv.createdAt) },
          ],
          ...(inv.vendorGstin ? [[{ label: "Vendor GSTIN", value: inv.vendorGstin, mono: true }]] : []),
        ]} />
      </PrintSection>

      {/* 3-way match table */}
      <PrintSection title={`3-Way Match — Line Items (${items.length})`}>
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}   style={{ width: 28 }}>#</th>
              <th className={tbl.th}>Material</th>
              <th className={tbl.thR} style={{ width: 60 }}>PO Qty</th>
              <th className={tbl.thR} style={{ width: 60 }}>GRN Qty</th>
              <th className={tbl.thR} style={{ width: 72 }}>Inv Qty</th>
              <th className={tbl.thR} style={{ width: 80 }}>Unit Price</th>
              <th className={tbl.thR} style={{ width: 90 }}>Line Total</th>
              <th className={tbl.thC} style={{ width: 70 }}>Match</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const invoicedQty = Number(item.invoicedQty ?? 0);
              const unitPrice   = Number(item.unitPrice   ?? 0);
              const lineTotal   = invoicedQty * unitPrice;
              const ms = MATCH_STYLE[item.matchStatus ?? ""] ?? null;
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td className={tbl.td}     style={{ color: "#9ca3af" }}>{i + 1}</td>
                  <td className={tbl.td}     style={{ fontWeight: 600 }}>{item.materialName ?? "—"}</td>
                  <td className={tbl.tdR}>{item.orderedQty  ?? "—"}</td>
                  <td className={tbl.tdR} style={{ color: "#166534" }}>{item.acceptedQty ?? item.grnQty ?? "—"}</td>
                  <td className={tbl.tdR} style={{ fontWeight: 700 }}>{item.invoicedQty ?? "—"}</td>
                  <td className={tbl.tdR}>{fmtINR(unitPrice)}</td>
                  <td className={tbl.tdR} style={{ fontWeight: 600 }}>{fmtINR(lineTotal)}</td>
                  <td className={tbl.tdC}>
                    {ms ? (
                      <span style={{
                        display: "inline-block", padding: "2px 5px", borderRadius: 4,
                        fontSize: 8, fontWeight: 700,
                        background: ms.bg, color: ms.color,
                      }}>
                        {ms.label}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className={tbl.td} style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>
                  No line items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PrintSection>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <TotalsBlock rows={totalsRows} />
      </div>

      {/* Payment instruction */}
      <PrintSection title="Payment Information">
        <p style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.7 }}>
          Payment will be processed as per the agreed terms upon completion of 3-way verification (PO · GRN · Invoice).
          Please ensure bank details are updated in the vendor portal prior to payment run.
        </p>
      </PrintSection>

      {/* Signature */}
      <div style={{ display: "flex", gap: 48, marginTop: 32 }}>
        {["Accounts Payable", "Finance Controller", "Authorised Signatory"].map(label => (
          <div key={label} style={{ flex: 1, borderTop: "1px solid #d1d5db", paddingTop: 8 }}>
            <p style={{ fontSize: 9, color: "#9ca3af" }}>{label}</p>
          </div>
        ))}
      </div>
    </PrintDocumentLayout>
  );
}
