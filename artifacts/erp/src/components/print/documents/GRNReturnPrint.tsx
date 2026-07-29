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

export function GRNReturnPrint({ rtv }: { rtv: any }) {
  const items: any[] = rtv.items ?? [];
  const totalValue = items.reduce((s, i) => s + (Number(i.returnQty ?? 0) * Number(i.unitPrice ?? 0)), 0);

  return (
    <PrintDocumentLayout
      docType="Return to Vendor"
      docNumber={rtv.returnNumber ?? `RTV-${rtv.id}`}
      docStatus={rtv.status}
    >
      {/* Return reason banner */}
      {rtv.reason && (
        <div style={{
          padding: "8px 12px", background: "#fff1f2", border: "1px solid #fecdd3",
          borderRadius: 8, marginBottom: 20,
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: "#9f1239", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Return Reason
          </p>
          <p style={{ fontSize: 11, color: "#111827", marginTop: 2 }}>{rtv.reason}</p>
        </div>
      )}

      {/* Meta */}
      <PrintSection title="Return Details">
        <MetaGrid rows={[
          [
            { label: "Return Type",   value: rtv.returnType },
            { label: "Return Date",   value: fmtDate(rtv.createdAt) },
          ],
          [
            { label: "GRN Reference", value: rtv.grnNumber, mono: true },
            { label: "PO Reference",  value: rtv.poNumber,  mono: true },
          ],
          [
            { label: "Vendor",        value: rtv.vendorName },
            { label: "Initiated By",  value: rtv.createdByName },
          ],
          ...(rtv.remarks ? [[{ label: "Remarks", value: rtv.remarks, wide: true }]] : []),
        ]} />
      </PrintSection>

      {/* Items */}
      <PrintSection title={`Return Items (${items.length})`}>
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}   style={{ width: 28 }}>#</th>
              <th className={tbl.th}>Material</th>
              <th className={tbl.thR} style={{ width: 72 }}>Return Qty</th>
              <th className={tbl.thR} style={{ width: 84 }}>Unit Price</th>
              <th className={tbl.thR} style={{ width: 96 }}>Line Value</th>
              <th className={tbl.th}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const qty        = Number(item.returnQty ?? 0);
              const unitPrice  = Number(item.unitPrice  ?? 0);
              const lineValue  = qty * unitPrice;
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td className={tbl.td}    style={{ color: "#9ca3af" }}>{i + 1}</td>
                  <td className={tbl.td}    style={{ fontWeight: 600 }}>{item.materialName ?? "—"}</td>
                  <td className={tbl.tdR}  style={{ color: "#991b1b", fontWeight: 700 }}>{qty.toLocaleString()}</td>
                  <td className={tbl.tdR}>{fmtINR(unitPrice)}</td>
                  <td className={tbl.tdR}  style={{ fontWeight: 600 }}>{fmtINR(lineValue)}</td>
                  <td className={tbl.td}   style={{ fontSize: 10, color: "#6b7280" }}>{item.reason ?? item.rejectionReason ?? "—"}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className={tbl.td} style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>
                  No return items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PrintSection>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <TotalsBlock rows={[
          { label: "Total Return Value", value: fmtINR(rtv.totalValue ?? totalValue), bold: true },
        ]} />
      </div>

      {/* Credit note */}
      {rtv.creditNoteNumber && (
        <PrintSection title="Credit Note Details">
          <MetaGrid rows={[[
            { label: "Credit Note #",  value: rtv.creditNoteNumber,   mono: true },
            { label: "CN Date",        value: fmtDate(rtv.creditNoteDate) },
          ], [
            { label: "CN Amount",      value: fmtINR(rtv.creditNoteAmount) },
          ]]} />
        </PrintSection>
      )}

      {/* Declaration */}
      <PrintSection title="Return Declaration">
        <p style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.7 }}>
          The above materials are being returned to the vendor due to the stated reasons. The vendor is requested to 
          issue a credit note for the return value and arrange collection at their cost.
        </p>
      </PrintSection>

      {/* Signature */}
      <div style={{ display: "flex", gap: 48, marginTop: 32 }}>
        {["Initiated By", "Quality / Warehouse", "Vendor Acknowledgement"].map(label => (
          <div key={label} style={{ flex: 1, borderTop: "1px solid #d1d5db", paddingTop: 8 }}>
            <p style={{ fontSize: 9, color: "#9ca3af" }}>{label}</p>
          </div>
        ))}
      </div>
    </PrintDocumentLayout>
  );
}
