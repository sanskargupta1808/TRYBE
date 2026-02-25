import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Users, MessageSquare, Plus, ChevronRight, Loader2, Mail, UserCheck } from "lucide-react";

export default function TableDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [newThread, setNewThread] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/tables", id],
    queryFn: async () => { const res = await fetch(`/api/tables/${id}`, { credentials: "include" }); if (!res.ok) throw new Error("Not found"); return res.json(); },
  });

  const joinMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", `/api/tables/${id}/join`, {}); return res.json(); },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["/api/tables", id] }); toast({ title: d.status === "requested" ? "Join request sent" : "Joined table" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", `/api/tables/${id}/leave`, {}); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tables", id] }); toast({ title: "Left table" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const threadMutation = useMutation({
    mutationFn: async (title: string) => { const res = await apiRequest("POST", `/api/tables/${id}/threads`, { title }); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tables", id] }); setNewThread(""); setShowNewThread(false); toast({ title: "Thread started" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const messageMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiRequest("POST", "/api/messages", { targetUserId });
      return res.json();
    },
    onSuccess: (conv) => {
      setMessagingUserId(null);
      navigate(`/app/messages/${conv.id}`);
    },
    onError: (err: any) => {
      setMessagingUserId(null);
      toast({ title: "Cannot start conversation", description: err.message, variant: "destructive" });
    },
  });

  const handleMessage = (memberId: string) => {
    setMessagingUserId(memberId);
    messageMutation.mutate(memberId);
  };

  const isHost = (data?.members || []).some(({ user: u, member }: any) => u?.id === user?.id && member?.memberRole === "HOST");

  const { data: joinRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/tables", id, "join-requests"],
    queryFn: async () => { const res = await fetch(`/api/tables/${id}/join-requests`, { credentials: "include" }); if (!res.ok) return []; return res.json(); },
    enabled: isHost,
    refetchInterval: 30000,
  });

  const pendingRequests = (joinRequests as any[]).filter((r: any) => r.request?.status === "PENDING");

  const joinRequestMutation = useMutation({
    mutationFn: async ({ reqId, action }: { reqId: string; action: "approve" | "decline" }) => {
      const res = await apiRequest("POST", `/api/tables/${id}/join-requests/${reqId}/${action}`, {});
      return res.json();
    },
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ["/api/tables", id, "join-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/tables", id] });
      toast({ title: action === "approve" ? "Member approved" : "Request declined" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 rounded-md" />
      <Skeleton className="h-40 rounded-md" />
    </div>
  );

  if (!data) return <div className="p-6 text-muted-foreground">Table not found.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/app/tables" className="flex items-center gap-1 text-muted-foreground text-sm mb-6 hover-elevate">
        <ArrowLeft className="h-4 w-4" />Back to tables
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl font-semibold text-foreground">{data.title}</h1>
          <div className="flex gap-2 flex-shrink-0">
            {data.isMember ? (
              <Button size="sm" variant="outline" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} data-testid="button-leave-table">
                {leaveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Leave table"}
              </Button>
            ) : (
              <Button size="sm" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} data-testid="button-join-table">
                {joinMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : (data.requiresApprovalToJoin ? "Request to join" : "Join table")}
              </Button>
            )}
          </div>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-3">{data.purpose}</p>
        <div className="flex flex-wrap gap-2 items-center">
          {(data.tags || []).map((tag: string) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
            <Users className="h-3 w-3" />
            <span>{data.members?.length || 0} member{data.members?.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Members */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Members</h2>
        <div className="space-y-2">
          {(data.members || []).map(({ user: u, member }: any) => (
            <div key={u.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2" data-testid={`badge-member-${u.id}`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary text-xs font-medium">{u.name?.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-sm text-foreground font-medium">{u.name}</span>
                  {u.organisation && <span className="text-xs text-muted-foreground ml-2">{u.organisation}</span>}
                </div>
                {member.memberRole === "HOST" && <Badge variant="secondary" className="text-xs ml-1">Host</Badge>}
              </div>
              {u.id !== user?.id && data.isMember && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-shrink-0 h-7 px-2"
                  onClick={() => handleMessage(u.id)}
                  disabled={messagingUserId === u.id}
                  data-testid={`button-message-member-${u.id}`}
                >
                  {messagingUserId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Mail className="h-3 w-3 mr-1" /><span className="text-xs">Message</span></>}
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Join Requests — visible to HOST only */}
      {isHost && pendingRequests.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground">Join requests ({pendingRequests.length})</h2>
          </div>
          <div className="space-y-2">
            {pendingRequests.map(({ request, user: u }: any) => (
              <div key={request.id} className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-md px-3 py-2.5" data-testid={`card-join-request-${request.id}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary text-xs font-medium">{u?.name?.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-medium">{u?.name}</p>
                    {u?.organisation && <p className="text-xs text-muted-foreground">{u.organisation}</p>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" onClick={() => joinRequestMutation.mutate({ reqId: request.id, action: "approve" })} disabled={joinRequestMutation.isPending} data-testid={`button-approve-join-${request.id}`}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => joinRequestMutation.mutate({ reqId: request.id, action: "decline" })} disabled={joinRequestMutation.isPending} data-testid={`button-decline-join-${request.id}`}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Threads */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-foreground">Threads</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Chronological and moderated for professional relevance</p>
          </div>
          {data.isMember && (
            <Button size="sm" variant="outline" onClick={() => setShowNewThread(v => !v)} data-testid="button-start-thread">
              <Plus className="h-3 w-3 mr-1" />Start a thread
            </Button>
          )}
        </div>

        {showNewThread && (
          <div className="bg-card border border-card-border rounded-md p-4 mb-3">
            <Input
              value={newThread}
              onChange={e => setNewThread(e.target.value)}
              placeholder="Thread title..."
              className="mb-2"
              data-testid="input-thread-title"
              onKeyDown={e => { if (e.key === "Enter" && newThread.trim()) threadMutation.mutate(newThread.trim()); }}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => threadMutation.mutate(newThread.trim())} disabled={!newThread.trim() || threadMutation.isPending} data-testid="button-create-thread">
                {threadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create thread"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewThread(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {(data.threads || []).length === 0 ? (
          <div className="bg-muted/30 border border-border rounded-md p-6 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm mb-1">No threads yet.</p>
            <p className="text-muted-foreground text-xs">Start the first discussion to set direction for this table.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(data.threads || []).map((thread: any) => (
              <Link key={thread.id} href={`/app/tables/${id}/threads/${thread.id}`}>
                <div className="flex items-center justify-between bg-card border border-card-border rounded-md px-4 py-3 hover-elevate" data-testid={`card-thread-${thread.id}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{thread.title}</p>
                      {thread.status === "CLOSED" && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Closed</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(thread.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {thread.postCount ?? 0} {thread.postCount === 1 ? "post" : "posts"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
