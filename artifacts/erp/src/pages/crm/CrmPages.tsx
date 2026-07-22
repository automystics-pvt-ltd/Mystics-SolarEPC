import { useGetClientPOs, useGetCrmInvoices, useGetTasks, useGetEscalations } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";

export function ClientPOsList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useGetClientPOs();

  // API returns flat ClientPO objects — filter directly on clientPoNumber
  const filtered = data?.filter(item =>
    (item.clientPoNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Client POs</h2>
        <p className="text-muted-foreground mt-1">Purchase orders received from clients.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-4 border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PO Number..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Contract Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked Project</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium font-mono">{item.clientPoNumber}</TableCell>
                    <TableCell>${Number(item.contractValue ?? 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'Active' ? 'default' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.projectId ? (
                        <Link href={`/projects/${item.projectId}`} className="text-primary hover:underline">
                          Project #{item.projectId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(item.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CrmInvoicesList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useGetCrmInvoices();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Accounts Receivable</h2>
        <p className="text-muted-foreground mt-1">Client invoices and payment tracking.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Invoice ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">INV-{inv.id.toString().padStart(4, '0')}</TableCell>
                    <TableCell>{inv.type}</TableCell>
                    <TableCell className="font-semibold">${inv.amount.toLocaleString()}</TableCell>
                    <TableCell>{inv.dueDate ? format(new Date(inv.dueDate), 'MMM d, yyyy') : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={inv.paymentStatus === 'Paid' ? 'default' : inv.paymentStatus === 'Overdue' ? 'destructive' : 'secondary'}>
                        {inv.paymentStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function TasksList() {
  const { data, isLoading } = useGetTasks();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
        <p className="text-muted-foreground mt-1">To-dos and action items.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[40%]">Task</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>
                      <Badge variant={task.priority === 'High' ? 'destructive' : task.priority === 'Medium' ? 'default' : 'secondary'}>
                        {task.priority || 'Normal'}
                      </Badge>
                    </TableCell>
                    <TableCell>{task.status}</TableCell>
                    <TableCell>{task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : '-'}</TableCell>
                    <TableCell>{task.ownerName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function EscalationsList() {
  const { data, isLoading } = useGetEscalations();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-destructive">Escalations</h2>
        <p className="text-muted-foreground mt-1">Issues requiring immediate attention.</p>
      </div>

      <Card className="shadow-sm border-destructive/20">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-destructive/5">
                <TableRow>
                  <TableHead className="w-[30%]">Reason</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Raised By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((esc) => (
                  <TableRow key={esc.id}>
                    <TableCell className="font-medium">{esc.reason}</TableCell>
                    <TableCell>{esc.module}</TableCell>
                    <TableCell>
                      <Badge variant={esc.severity === 'Critical' ? 'destructive' : 'secondary'}>
                        {esc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{esc.status}</TableCell>
                    <TableCell>{esc.raisedByName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(esc.createdAt), 'MMM d')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
