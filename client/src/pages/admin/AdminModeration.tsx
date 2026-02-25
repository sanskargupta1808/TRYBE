import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle, XCircle } from "lucide-react";

export default function AdminModeration() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/moderation"] });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, adminNote }: { id: string; action: string; adminNote?: string }) => {
      const res = await apiRequest("POST", `/api/admin/moderation/${id}/review`, { action, adminNote });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/moderation"] }); toast({ title: "Moderation action taken" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const open = items.filter((i: any) => i.status === "PENDING" || i.status === "UNDER_REVIEW");
  const resolved = items.filter((i: any) => i.status !== "PENDING" && i.status !== "UNDER_REVIEW");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Moderation Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">Review flagged content and member conduct</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-28 rounded-md" />)}</div>
      ) : open.length === 0 && resolved.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-md p-8 text-center">
          <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="font-medium text-foreground mb-1">All clear</p>
          <p className="text-muted-foreground text-sm">No items in the moderation queue.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Open ({open.length})</h2>
              <div className="space-y-3">
                {open.map((item: any) => (
                  <div key={item.id} className="bg-card border border-card-border rounded-md p-4" data-testid={`card-mod-${item.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="secondary" className="text-xs">{item.contentType}</Badge>
                          <span className="text-xs text-muted-foreground">{item.reportType || "REPORTED"}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400`}>{item.status}</span>
                        </div>
                        {item.reason && <p className="text-xs text-foreground mt-1">{item.reason}</p>}
                        <p className="text-xs text-muted-foreground mt-1">Reported {new Date(item.createdAt).toLocaleDateString("en-GB")}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => reviewMutation.mutate({ id: item.id, action: "DISMISS" })} disabled={reviewMutation.isPending} data-testid={`button-dismiss-${item.id}`}>
                          <CheckCircle className="h-3 w-3 mr-1" />Dismiss
                        </Button>
                        <Button size="sm" onClick={() => reviewMutation.mutate({ id: item.id, action: "ACTION" })} disabled={reviewMutation.isPending} data-testid={`button-action-${item.id}`}>
                          <XCircle className="h-3 w-3 mr-1" />Take action
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {resolved.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Resolved</h2>
              <div className="space-y-2">
                {resolved.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between bg-muted/30 border border-border rounded-md px-4 py-2" data-testid={`card-mod-resolved-${item.id}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{item.contentType}</Badge>
                      <span className="text-xs text-muted-foreground">{item.resolution || item.status}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
