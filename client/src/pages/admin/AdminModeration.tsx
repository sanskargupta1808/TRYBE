import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, CheckCircle, AlertTriangle, Ban, MessageSquare, Trash2, ChevronDown, ChevronUp } from "lucide-react";

export default function AdminModeration() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [warningMessages, setWarningMessages] = useState<Record<string, string>>({});

  const { data: items = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/moderation"] });

  const reviewMutation = useMutation({
    mutationFn: async (payload: { id: string; action: string; warningMessage?: string; targetUserId?: string }) => {
      const res = await apiRequest("POST", `/api/admin/moderation/${payload.id}/review`, payload);
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/moderation"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      const msg = variables.action === "WARN" ? "Warning sent via DM"
        : variables.action === "SUSPEND" ? "Account suspended — email sent"
        : variables.action === "REMOVE_POST" ? "Post removed and item resolved"
        : "Item resolved";
      toast({ title: msg });
      setExpandedItem(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const open = items.filter((i: any) => i.status === "PENDING" || i.status === "UNDER_REVIEW" || i.status === "OPEN");
  const resolved = items.filter((i: any) => i.status !== "PENDING" && i.status !== "UNDER_REVIEW" && i.status !== "OPEN");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-foreground heading-rule">Moderation Queue</h1>
        <p className="text-muted-foreground text-sm mt-2">Review flagged content and take action on conduct violations</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-md" />)}</div>
      ) : open.length === 0 && resolved.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-xl p-10 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08), transparent 70%)' }}>
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground mb-1">All clear</p>
          <p className="text-muted-foreground text-sm">No items in the moderation queue.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <section className="animate-fade-in-up stagger-1">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Requires Review ({open.length})</h2>
              <div className="space-y-3">
                {open.map((item: any) => {
                  const isExpanded = expandedItem === item.id;
                  return (
                    <div key={item.id} className="bg-card border border-card-border rounded-xl overflow-hidden" data-testid={`card-mod-${item.id}`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge variant="secondary" className="text-xs">{item.contentType}</Badge>
                              <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                {item.status}
                              </span>
                              {item.reporterName && (
                                <span className="text-xs text-muted-foreground">Reported by {item.reporterName}</span>
                              )}
                            </div>

                            {item.reason && (
                              <p className="text-sm text-foreground mt-1.5 font-medium">{item.reason}</p>
                            )}

                            {item.authorName && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Author: <span className="font-medium text-foreground">{item.authorName}</span>
                                {item.authorEmail && <span> ({item.authorEmail})</span>}
                              </p>
                            )}

                            {item.tableTitle && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                In: {item.tableTitle}{item.threadTitle && ` → ${item.threadTitle}`}
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                            data-testid={`button-expand-mod-${item.id}`}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>

                        {item.postContent && (
                          <div className="mt-3 bg-muted/40 border border-border rounded-lg p-3" data-testid={`text-flagged-content-${item.id}`}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Flagged content</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{item.postContent}</p>
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20 p-4 space-y-4" data-testid={`actions-panel-${item.id}`}>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Warning message (sent as DM to author)</label>
                            <Textarea
                              placeholder="Describe the conduct issue and expected behaviour..."
                              value={warningMessages[item.id] || ""}
                              onChange={e => setWarningMessages(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="text-sm min-h-[80px]"
                              data-testid={`textarea-warning-${item.id}`}
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reviewMutation.mutate({ id: item.id, action: "DISMISS" })}
                              disabled={reviewMutation.isPending}
                              data-testid={`button-dismiss-${item.id}`}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              Dismiss
                            </Button>

                            {item.authorId && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const msg = warningMessages[item.id]?.trim();
                                  if (!msg) { toast({ title: "Please write a warning message", variant: "destructive" }); return; }
                                  reviewMutation.mutate({ id: item.id, action: "WARN", warningMessage: msg, targetUserId: item.authorId });
                                }}
                                disabled={reviewMutation.isPending}
                                data-testid={`button-warn-${item.id}`}
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                Send Warning DM
                              </Button>
                            )}

                            {item.contentType === "POST" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/20"
                                onClick={() => reviewMutation.mutate({ id: item.id, action: "REMOVE_POST", targetUserId: item.authorId })}
                                disabled={reviewMutation.isPending}
                                data-testid={`button-remove-post-${item.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                Remove Post
                              </Button>
                            )}

                            {item.authorId && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => reviewMutation.mutate({ id: item.id, action: "SUSPEND", targetUserId: item.authorId })}
                                disabled={reviewMutation.isPending}
                                data-testid={`button-suspend-author-${item.id}`}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1.5" />
                                Suspend Account
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {resolved.length > 0 && (
            <section className="animate-fade-in-up stagger-2">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Resolved ({resolved.length})</h2>
              <div className="space-y-2">
                {resolved.slice(0, 15).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between bg-muted/30 border border-border rounded-xl px-4 py-2.5" data-testid={`card-mod-resolved-${item.id}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="secondary" className="text-xs">{item.contentType}</Badge>
                      {item.authorName && <span className="text-xs text-foreground font-medium">{item.authorName}</span>}
                      {item.reason && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{item.reason}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {item.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.resolvedAt || item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </div>
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
