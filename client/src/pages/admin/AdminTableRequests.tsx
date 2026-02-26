import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Inbox, Info } from "lucide-react";

export default function AdminTableRequests() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/table-requests"] });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "APPROVE" | "DECLINE" }) => {
      const endpoint = action === "APPROVE" ? "approve" : "decline";
      const res = await apiRequest("POST", `/api/admin/table-requests/${id}/${endpoint}`, {});
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/table-requests"] }); toast({ title: "Table request updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pending = requests.filter((r: any) => r.status === "PENDING");
  const reviewed = requests.filter((r: any) => r.status !== "PENDING");

  const Card = ({ req }: { req: any }) => (
    <div className="bg-card border border-card-border rounded-xl p-4" data-testid={`card-tablereq-${req.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-sm text-foreground">{req.title}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${req.status === "APPROVED" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : req.status === "DECLINED" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}`}>{req.status}</span>
          </div>
          {req.purpose && <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{req.purpose}</p>}
          {(req.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">{req.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div>
          )}
          {req.reason && (
            <div className="bg-muted/50 rounded p-2 mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Why now?</p>
              <p className="text-xs text-foreground">{req.reason}</p>
            </div>
          )}
        </div>
        {req.status === "PENDING" && (
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" onClick={() => actionMutation.mutate({ id: req.id, action: "APPROVE" })} disabled={actionMutation.isPending} data-testid={`button-approve-${req.id}`}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => actionMutation.mutate({ id: req.id, action: "DECLINE" })} disabled={actionMutation.isPending} data-testid={`button-reject-${req.id}`}>Decline</Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Table Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">Legacy table requests. Members can now create tables directly.</p>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex gap-3 items-start">
        <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-sm text-muted-foreground">Table creation no longer requires admin approval. Members create tables directly and become the host. Tables inactive for 14 days are automatically removed.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-32 rounded-md" />)}</div>
      ) : pending.length === 0 && reviewed.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-xl p-8 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No table requests.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Pending ({pending.length})</h2>
              <div className="space-y-3">{pending.map((r: any) => <Card key={r.id} req={r} />)}</div>
            </section>
          )}
          {reviewed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Reviewed</h2>
              <div className="space-y-3">{reviewed.map((r: any) => <Card key={r.id} req={r} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
