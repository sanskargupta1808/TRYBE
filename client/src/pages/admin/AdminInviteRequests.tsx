import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Inbox } from "lucide-react";

export default function AdminInviteRequests() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/invite-requests"] });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await apiRequest("POST", `/api/admin/invite-requests/${id}/action`, { action });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/invite-requests"] }); toast({ title: "Request updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pending = requests.filter(r => r.status === "PENDING");
  const reviewed = requests.filter(r => r.status !== "PENDING");

  const Card = ({ req }: { req: any }) => (
    <div className="bg-card border border-card-border rounded-md p-4" data-testid={`card-request-${req.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-medium text-sm text-foreground">{req.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${req.status === "APPROVED" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : req.status === "REJECTED" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}`}>{req.status}</span>
          </div>
          <p className="text-xs text-muted-foreground">{req.email} · {req.organisation}</p>
          {req.role && <p className="text-xs text-muted-foreground">{req.role}</p>}
          {req.reason && (
            <div className="mt-2 bg-muted/50 rounded p-2">
              <p className="text-xs text-foreground leading-relaxed">{req.reason}</p>
            </div>
          )}
          {req.linkedinUrl && <a href={req.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{req.linkedinUrl}</a>}
        </div>
        {req.status === "PENDING" && (
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" onClick={() => actionMutation.mutate({ id: req.id, action: "APPROVE" })} disabled={actionMutation.isPending} data-testid={`button-approve-${req.id}`}>Approve</Button>
            <Button size="sm" variant="outline" onClick={() => actionMutation.mutate({ id: req.id, action: "REJECT" })} disabled={actionMutation.isPending} data-testid={`button-reject-${req.id}`}>Reject</Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Invite Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">People requesting access to TRYBE without a code</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-md" />)}</div>
      ) : pending.length === 0 && reviewed.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-md p-8 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No invite requests yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Pending ({pending.length})</h2>
              <div className="space-y-3">{pending.map(r => <Card key={r.id} req={r} />)}</div>
            </section>
          )}
          {reviewed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Reviewed</h2>
              <div className="space-y-3">{reviewed.slice(0, 20).map(r => <Card key={r.id} req={r} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
