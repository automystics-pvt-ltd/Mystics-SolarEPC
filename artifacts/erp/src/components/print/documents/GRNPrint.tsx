import { format } from "date-fns";
import { PrintDocumentLayout, PrintSection, MetaGrid, tbl } from "../PrintDocumentLayout";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
}

const QC_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  Accepted:  { label: "Accepted",  color: "#166534", bg: "#dcfce7" },
  Rejected:  { label: "Rejected",  color: "#991b1b", bg: "#fee2e2" },
  Partial:   { label: "Partial",   color: "#854d0e", bg: "#fef9c3" },
  Pending:   { label: "Pending",   color: "#1e40af", bg: "#dbeafe" },
};

export function GRNPrint({ grn }: { grn: any }) {
  const g     = grn;
  const items: any[] = g.items ?? [];

  const totalOrdered  = items.reduce((s, i) => s + Number(i.orderedQty  ?? 0), 0);
  const totalReceived = items.reduce((s, i) => s + Number(i.receivedQty ?? 0), 0);
  const totalAccepted = items.reduce((s, i) => s + Number(i.acceptedQty ?? 0), 0);
  const totalRejected = items.reduce((s, i) => s + Number(i.rejectedQty ?? 0), 0);

  return (
    <PrintDocumentLayout
      docType="Goods Received Note"
      docNumber={g.grnNumber ?? `GRN-${g.id}`}
      docStatus={g.status}
    >
      {/* Meta */}
      <PrintSection title="Receipt Details">
        <MetaGrid rows={[
          [
            { label: "Vendor",       value: g.vendorName },
            { label: "Received By",  value: g.receivedByName },
          ],
          [
            { label: "PO Reference", value: g.poNumber,      mono: true },
            { label: "Date Received",value: fmtDate(g.receivedAt ?? g.createdAt) },
          ],
          [
            { label: "Vehicle No.",  value: g.vehicleNumber, mono: true },
            { label: "DC / Challan", value: g.dcNumber ?? g.deliveryChallanNumber, mono: true },
          ],
          ...(g.projectId ? [[{ label: "Project", value: `PRJ-${String(g.projectId).padStart(4, "0")}` }]] : []),
          ...(g.remarks   ? [[{ label: "Remarks", value: g.remarks, wide: true }]]                        : []),
        ]} />
      </PrintSection>

      {/* Summary bar */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 20,
        border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden",
      }}>
        {[
          { label: "Ordered",  value: totalOrdered,  color: "#374151" },
          { label: "Received", value: totalReceived, color: "#1d4ed8" },
          { label: "Accepted", value: totalAccepted, color: "#166534" },
          { label: "Rejected", value: totalRejected, color: "#991b1b" },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: "10px 0", textAlign: "center",
            borderRight: i < 3 ? "1px solid #e5e7eb" : "none",
            background: i % 2 === 0 ? "white" : "#f9fafb",
          }}>
            <p style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: s.color }}>
              {s.value.toLocaleString()}
            </p>
            <p style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <PrintSection title={`Inspection Results (${items.length} materials)`}>
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}   style={{ width: 28 }}>#</th>
              <th className={tbl.th}>Material</th>
              <th className={tbl.thR} style={{ width: 64 }}>Ordered</th>
              <th className={tbl.thR} style={{ width: 64 }}>Received</th>
              <th className={tbl.thR} style={{ width: 64 }}>Accepted</th>
              <th className={tbl.thR} style={{ width: 64 }}>Rejected</th>
              <th className={tbl.thC} style={{ width: 80 }}>QC Status</th>
              <th className={tbl.th}>Rejection Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const qc = QC_LABEL[item.qcStatus] ?? { label: item.qcStatus ?? "—", color: "#6b7280", bg: "#f3f4f6" };
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td className={tbl.td} style={{ color: "#9ca3af" }}>{i + 1}</td>
                  <td className={tbl.td}>
                    <span style={{ fontWeight: 600 }}>{item.materialName ?? "—"}</span>
                    {item.batchNumber && <p style={{ fontSize: 9, color: "#6b7280", marginTop: 1 }}>Batch: {item.batchNumber}</p>}
                  </td>
                  <td className={tbl.tdR}>{item.orderedQty  ?? "—"}</td>
                  <td className={tbl.tdR} style={{ color: "#1d4ed8" }}>{item.receivedQty ?? "—"}</td>
                  <td className={tbl.tdR} style={{ color: "#166534", fontWeight: 700 }}>{item.acceptedQty ?? "—"}</td>
                  <td className={tbl.tdR} style={{ color: "#991b1b" }}>{item.rejectedQty ?? "—"}</td>
                  <td className={tbl.tdC}>
                    <span style={{
                      display: "inline-block", padding: "2px 6px", borderRadius: 4,
                      fontSize: 9, fontWeight: 700,
                      background: qc.bg, color: qc.color,
                    }}>
                      {qc.label}
                    </span>
                  </td>
                  <td className={tbl.td} style={{ fontSize: 10, color: "#6b7280" }}>
                    {item.rejectionReason ?? "—"}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className={tbl.td} style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>
                  No items recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PrintSection>

      {/* Acceptance note */}
      <PrintSection title="Inspection Declaration">
        <p style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.7 }}>
          I hereby certify that the above goods have been received and inspected as per the quantities stated. 
          Accepted quantities have been admitted into stores and rejected quantities are pending return.
        </p>
      </PrintSection>

      {/* Signature */}
      <div style={{ display: "flex", gap: 48, marginTop: 32 }}>
        {["Received & Inspected By", "Warehouse In-charge", "Authorised Signatory"].map(label => (
          <div key={label} style={{ flex: 1, borderTop: "1px solid #d1d5db", paddingTop: 8 }}>
            <p style={{ fontSize: 9, color: "#9ca3af" }}>{label}</p>
          </div>
        ))}
      </div>
    </PrintDocumentLayout>
  );
}
