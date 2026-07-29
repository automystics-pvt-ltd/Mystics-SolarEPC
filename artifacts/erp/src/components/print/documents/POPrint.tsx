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

export function POPrint({ po }: { po: any }) {
  const p = po;
  const items: any[] = p.items ?? [];
  const subtotal    = Number(p.subtotal   ?? 0);
  const gstAmount   = Number(p.gstAmount  ?? p.totalGst ?? 0);
  const totalAmount = Number(p.totalAmount ?? 0);

  const metaRows = [
    [
      { label: "Vendor",        value: p.vendorName },
      { label: "PO Date",       value: fmtDate(p.poDate) },
    ],
    [
      { label: "Vendor GSTIN",  value: p.vendorGstin,  mono: true },
      { label: "Payment Terms", value: p.paymentTerms },
    ],
    [
      { label: "Created By",    value: p.createdByName },
      { label: "Approved By",   value: p.approvedByName ? `${p.approvedByName}${p.approvedAt ? " · " + fmtDate(p.approvedAt) : ""}` : undefined },
    ],
    [
      { label: "Delivery Deadline", value: fmtDate(p.deliveryDeadline ?? p.expectedDeliveryDate) },
      { label: "Warranty",       value: p.warrantyMonths ? `${p.warrantyMonths} months` : undefined },
    ],
    ...(p.deliveryAddress ? [[{ label: "Delivery Address", value: p.deliveryAddress, wide: true }]] : []),
  ];

  return (
    <PrintDocumentLayout
      docType="Purchase Order"
      docNumber={p.poNumber ?? `PO-${p.id}`}
      docStatus={p.status}
    >
      {/* Meta */}
      <PrintSection title="Purchase Order Details">
        <MetaGrid rows={metaRows} />
      </PrintSection>

      {/* Items table */}
      <PrintSection title={`Line Items (${items.length})`}>
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}    style={{ width: 28 }}>#</th>
              <th className={tbl.th}>Material / Description</th>
              <th className={tbl.thC}  style={{ width: 52 }}>UOM</th>
              <th className={tbl.thR}  style={{ width: 56 }}>Qty</th>
              <th className={tbl.thR}  style={{ width: 80 }}>Unit Price</th>
              <th className={tbl.thC}  style={{ width: 44 }}>GST%</th>
              <th className={tbl.thR}  style={{ width: 88 }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const qty       = Number(item.quantity ?? item.orderedQty ?? item.qty ?? 0);
              const unitPrice = Number(item.unitPrice ?? 0);
              const gstPct    = Number(item.gstPct ?? item.gstRate ?? 0);
              const lineBase  = qty * unitPrice;
              const lineTotal = lineBase * (1 + gstPct / 100);

              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td className={tbl.td}     style={{ color: "#9ca3af" }}>{i + 1}</td>
                  <td className={tbl.td}>
                    <span style={{ fontWeight: 600, fontSize: 11 }}>{item.materialName ?? item.name ?? item.description ?? "—"}</span>
                    {item.description && item.description !== item.materialName && (
                      <p style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{item.description}</p>
                    )}
                    {item.batchNumber && (
                      <p style={{ fontSize: 9, color: "#6b7280", marginTop: 1 }}>Batch: {item.batchNumber}</p>
                    )}
                  </td>
                  <td className={tbl.tdC}>{item.uom ?? "NOS"}</td>
                  <td className={tbl.tdR}>{qty.toLocaleString()}</td>
                  <td className={tbl.tdR}>{fmtINR(unitPrice)}</td>
                  <td className={tbl.tdC}>{gstPct}%</td>
                  <td className={tbl.tdR} style={{ fontWeight: 600 }}>{fmtINR(lineTotal)}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className={tbl.td} style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>
                  No line items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PrintSection>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <TotalsBlock rows={[
          { label: "Subtotal (excl. GST)", value: fmtINR(subtotal) },
          { label: "GST Amount",           value: fmtINR(gstAmount) },
          { label: "Grand Total",          value: fmtINR(totalAmount), bold: true, separator: true },
        ]} />
      </div>

      {/* Terms */}
      <PrintSection title="Terms & Conditions">
        <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.7 }}>
          <p>1. All goods are subject to quality inspection on receipt. Rejected goods must be replaced within 7 days.</p>
          <p>2. Payment will be processed as per agreed payment terms after GRN acceptance and invoice matching.</p>
          <p>3. Vendor must provide delivery challan and invoice at the time of delivery.</p>
          <p>4. This PO is valid only when bearing the authorised digital signature / approval reference.</p>
        </div>
      </PrintSection>

      {/* Signature block */}
      <div style={{ display: "flex", gap: 48, marginTop: 32 }}>
        {["Prepared By", "Reviewed By", "Authorised Signatory"].map(label => (
          <div key={label} style={{ flex: 1, borderTop: "1px solid #d1d5db", paddingTop: 8 }}>
            <p style={{ fontSize: 9, color: "#9ca3af" }}>{label}</p>
          </div>
        ))}
      </div>
    </PrintDocumentLayout>
  );
}
