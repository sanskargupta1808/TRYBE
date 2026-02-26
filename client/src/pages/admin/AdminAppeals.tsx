import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, CheckCircle, XCircle, Clock } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function AdminAppeals() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: appeals = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/reactivation-appeals"] });

  const actionMutation = useMutation({
    mutationFn: async ({ appealId, action }: { appealId: string; action: string }) => {
      const res = await apiRequest("POST", `/api/admin/reactivation-appeals/${appealId}/action`, { action });
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/reactivation-appeals"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: variables.action === "APPROVE" ? "Account reactivated — email sent to user" : "Appeal rejected" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pending = appeals.filter((a: any) => a.status === "PENDING");
  const resolved = appeals.filter((a: any) => a.status !== "PENDING");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-foreground heading-rule">Reactivation Appeals</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Review reactivation requests from suspended users. Approving an appeal will reactivate their account and send a confirmation email.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-md" />)}</div>
      ) : appeals.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-xl p-10 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08), transparent 70%)' }}>
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No reactivation appeals have been submitted yet.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mb-8 animate-fade-in-up stagger-1">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((appeal: any) => (
                  <div key={appeal.id} className="bg-card border border-card-border rounded-xl p-5" data-testid={`card-appeal-${appeal.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-medium text-foreground">{appeal.user?.name || "Unknown user"}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${STATUS_COLORS.PENDING}`}>Pending</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{appeal.user?.email} {appeal.user?.organisation && `· ${appeal.user.organisation}`}</p>
                        <div className="bg-muted/40 border border-border rounded-lg p-3 mb-3">
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap" data-testid={`text-appeal-message-${appeal.id}`}>{appeal.message}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Submitted {new Date(appeal.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} at {new Date(appeal.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => actionMutation.mutate({ appealId: appeal.id, action: "APPROVE" })}
                          disabled={actionMutation.isPending}
                          data-testid={`button-approve-appeal-${appeal.id}`}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />Reactivate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionMutation.mutate({ appealId: appeal.id, action: "REJECT" })}
                          disabled={actionMutation.isPending}
                          data-testid={`button-reject-appeal-${appeal.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section className="animate-fade-in-up stagger-2">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Previous appeals ({resolved.length})</h2>
              <div className="space-y-2">
                {resolved.map((appeal: any) => (
                  <div key={appeal.id} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center justify-between gap-3 opacity-70" data-testid={`card-resolved-appeal-${appeal.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{appeal.user?.name || "Unknown"}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${STATUS_COLORS[appeal.status] || ""}`}>{appeal.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{appeal.message}</p>
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {appeal.reviewedAt ? new Date(appeal.reviewedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
