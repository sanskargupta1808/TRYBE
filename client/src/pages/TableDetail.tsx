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
import { ArrowLeft, Users, MessageSquare, Plus, ChevronRight, Loader2, Mail, Lock, Globe, Check, X, Shield, ShieldCheck, UserMinus, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { tagColour } from "@/lib/utils";

export default function TableDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [newThread, setNewThread] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [showAllThreads, setShowAllThreads] = useState(false);
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

  const myMembership = (data?.members || []).find(({ user: u }: any) => u?.id === user?.id);
  const myRole = myMembership?.member?.memberRole;
  const isHost = myRole === "HOST";
  const isAssignee = myRole === "ASSIGNEE";
  const canManage = isHost || isAssignee;

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("POST", `/api/tables/${id}/members/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tables", id] }); toast({ title: "Role updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/tables/${id}/members/${userId}/remove`, {});
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tables", id] }); toast({ title: "Member removed" }); },
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
      <Link href="/app/tables" className="flex items-center gap-1 text-muted-foreground text-sm mb-6 hover-elevate animate-fade-in">
        <ArrowLeft className="h-4 w-4" />Back to tables
      </Link>

      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl font-semibold text-foreground">{data.title}</h1>
          <div className="flex gap-2 flex-shrink-0">
            {data.isMember ? (
              <Button size="sm" variant="outline" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} data-testid="button-leave-table">
                {leaveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Leave table"}
              </Button>
            ) : data.hasPendingRequest ? (
              <Button size="sm" variant="outline" disabled data-testid="button-join-table">
                <Loader2 className="h-3 w-3 mr-1" />Request pending
              </Button>
            ) : (
              <Button size="sm" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} data-testid="button-join-table">
                {joinMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : data.requiresApprovalToJoin ? "Request to join" : "Join table"}
              </Button>
            )}
          </div>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-3">{data.purpose}</p>
        <div className="flex flex-wrap gap-2 items-center">
          {data.requiresApprovalToJoin ? (
            <Badge variant="outline" className="gap-0.5"><Lock className="h-2.5 w-2.5" />Private</Badge>
          ) : (
            <Badge variant="outline" className="gap-0.5"><Globe className="h-2.5 w-2.5" />Public</Badge>
          )}
          {(data.tags || []).map((tag: string) => <Badge key={tag} variant="secondary" className={`border ${tagColour(tag)}`}>{tag}</Badge>)}
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
            <Users className="h-3 w-3" />
            <span>{data.members?.length || 0} member{data.members?.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Members */}
      <section className="mb-6 animate-fade-in-up stagger-1">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Members</h2>
        <div className="space-y-2">
          {(data.members || []).map(({ user: u, member }: any) => {
            const memberRole = member?.memberRole;
            const isMe = u.id === user?.id;
            const canChangeRole = isHost && !isMe && memberRole !== "HOST";
            const canRemove = (isHost && !isMe && memberRole !== "HOST") || (isAssignee && !isMe && memberRole === "MEMBER");
            const showMenu = canChangeRole || canRemove;
            return (
              <div key={u.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2" data-testid={`badge-member-${u.id}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary text-xs font-medium">{u.name?.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm text-foreground font-medium">{u.name}</span>
                    {u.handle && <span className="text-xs text-muted-foreground ml-1">@{u.handle}</span>}
                    {u.organisation && <span className="text-xs text-muted-foreground ml-2">{u.organisation}</span>}
                  </div>
                  {memberRole === "HOST" && <Badge variant="secondary" className="text-xs ml-1 gap-0.5"><ShieldCheck className="h-2.5 w-2.5" />Host</Badge>}
                  {memberRole === "ASSIGNEE" && <Badge variant="outline" className="text-xs ml-1 gap-0.5"><Shield className="h-2.5 w-2.5" />Assignee</Badge>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {u.id !== user?.id && data.isMember && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleMessage(u.id)}
                      disabled={messagingUserId === u.id}
                      data-testid={`button-message-member-${u.id}`}
                    >
                      {messagingUserId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Mail className="h-3 w-3 mr-1" /><span className="text-xs">Message</span></>}
                    </Button>
                  )}
                  {showMenu && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-manage-member-${u.id}`}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canChangeRole && memberRole === "MEMBER" && (
                          <DropdownMenuItem onClick={() => roleMutation.mutate({ userId: u.id, role: "ASSIGNEE" })} data-testid={`button-promote-${u.id}`}>
                            <Shield className="h-3.5 w-3.5 mr-2" />Make Assignee
                          </DropdownMenuItem>
                        )}
                        {canChangeRole && memberRole === "ASSIGNEE" && (
                          <DropdownMenuItem onClick={() => roleMutation.mutate({ userId: u.id, role: "MEMBER" })} data-testid={`button-demote-${u.id}`}>
                            <Users className="h-3.5 w-3.5 mr-2" />Make Member
                          </DropdownMenuItem>
                        )}
                        {canRemove && (
                          <DropdownMenuItem className="text-destructive" onClick={() => removeMemberMutation.mutate(u.id)} data-testid={`button-remove-member-${u.id}`}>
                            <UserMinus className="h-3.5 w-3.5 mr-2" />Remove
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Join Requests (Host or Assignee, private tables) */}
      {canManage && data.requiresApprovalToJoin && <JoinRequests tableId={id!} />}

      {/* Threads */}
      <section className="animate-fade-in-up stagger-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-foreground">Discussions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Members collaborate here through structured discussion threads</p>
          </div>
          {data.isMember && (
            <Button size="sm" variant="outline" onClick={() => setShowNewThread(v => !v)} data-testid="button-start-thread">
              <Plus className="h-3 w-3 mr-1" />Start a discussion
            </Button>
          )}
        </div>

        {showNewThread && (
          <div className="bg-card border border-card-border rounded-xl p-4 mb-3">
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
          <div className="bg-muted/30 border border-border rounded-xl p-10 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08), transparent 70%)' }}>
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-1">No discussions yet.</p>
            <p className="text-muted-foreground text-xs">Start the first discussion to set direction for this table.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(data.threads || []).slice(0, showAllThreads ? undefined : 5).map((thread: any) => (
              <Link key={thread.id} href={`/app/tables/${id}/threads/${thread.id}`}>
                <div className="flex items-center justify-between bg-card border border-card-border rounded-xl px-5 py-4 hover-elevate hover:shadow-sm transition-shadow duration-200" data-testid={`card-thread-${thread.id}`}>
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
            {!showAllThreads && (data.threads || []).length > 5 && (
              <button onClick={() => setShowAllThreads(true)} className="text-xs text-primary hover:underline mt-2" data-testid="button-view-all-threads">
                View all {data.threads.length} threads
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function JoinRequests({ tableId }: { tableId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/tables", tableId, "join-requests"],
    queryFn: async () => { const res = await fetch(`/api/tables/${tableId}/join-requests`, { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
  });

  const approveMutation = useMutation({
    mutationFn: async (reqId: string) => { const res = await apiRequest("POST", `/api/tables/${tableId}/join-requests/${reqId}/approve`, {}); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tables", tableId] }); qc.invalidateQueries({ queryKey: ["/api/tables", tableId, "join-requests"] }); toast({ title: "Request approved" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: async (reqId: string) => { const res = await apiRequest("POST", `/api/tables/${tableId}/join-requests/${reqId}/decline`, {}); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tables", tableId, "join-requests"] }); toast({ title: "Request declined" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pending = (requests || []).filter((r: any) => r.request.status === "PENDING");

  if (isLoading || pending.length === 0) return null;

  return (
    <section className="mb-6 animate-fade-in-up stagger-1">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        Join requests
        <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
      </h2>
      <div className="space-y-2">
        {pending.map((r: any) => (
          <div key={r.request.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2" data-testid={`join-request-${r.request.id}`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary text-xs font-medium">{r.user?.name?.charAt(0) || "?"}</span>
              </div>
              <div className="min-w-0">
                <span className="text-sm text-foreground font-medium">{r.user?.name || "Unknown"}</span>
                {r.user?.handle && <span className="text-xs text-muted-foreground ml-1">@{r.user.handle}</span>}
                {r.user?.healthRole && <span className="text-xs text-muted-foreground ml-2">{r.user.healthRole}</span>}
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <Button size="sm" className="h-7 px-2" onClick={() => approveMutation.mutate(r.request.id)} disabled={approveMutation.isPending} data-testid={`button-approve-${r.request.id}`}>
                <Check className="h-3 w-3 mr-1" />Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => declineMutation.mutate(r.request.id)} disabled={declineMutation.isPending} data-testid={`button-decline-${r.request.id}`}>
                <X className="h-3 w-3 mr-1" />Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
