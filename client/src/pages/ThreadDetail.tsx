import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Loader2, Send, Flag, Pencil, Trash2, Lock, X, Check } from "lucide-react";

export default function ThreadDetail() {
  const { tableId, threadId } = useParams<{ tableId: string; threadId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/threads", threadId],
    queryFn: async () => { const res = await fetch(`/api/threads/${threadId}`, { credentials: "include" }); if (!res.ok) throw new Error("Not found"); return res.json(); },
    refetchInterval: 15000,
  });

  const postMutation = useMutation({
    mutationFn: async (c: string) => { const res = await apiRequest("POST", `/api/threads/${threadId}/posts`, { content: c }); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/threads", threadId] }); setContent(""); },
    onError: (err: any) => toast({ title: "Could not post", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, content: c }: { id: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/posts/${id}`, { content: c });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/threads", threadId] }); setEditingPostId(null); toast({ title: "Post updated" }); },
    onError: (err: any) => toast({ title: "Could not update post", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("DELETE", `/api/posts/${id}`, {}); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/threads", threadId] }); toast({ title: "Post deleted" }); },
    onError: (err: any) => toast({ title: "Could not delete post", description: err.message, variant: "destructive" }),
  });

  const flagMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/posts/${id}/flag`, {}); return res.json(); },
    onSuccess: () => toast({ title: "Post reported", description: "Our moderation team will review this." }),
    onError: (err: any) => toast({ title: "Could not report post", description: err.message, variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", `/api/threads/${threadId}/close`, {}); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/threads", threadId] }); toast({ title: "Thread closed" }); },
    onError: (err: any) => toast({ title: "Could not close thread", description: err.message, variant: "destructive" }),
  });

  const startEdit = (postId: string, currentContent: string) => {
    setEditingPostId(postId);
    setEditContent(currentContent);
  };

  const confirmDelete = (postId: string) => {
    if (window.confirm("Delete this post? This cannot be undone.")) {
      deleteMutation.mutate(postId);
    }
  };

  const isClosed = data?.status === "CLOSED";

  if (isLoading) return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 rounded-md" />
      <Skeleton className="h-20 rounded-md" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href={`/app/tables/${tableId}`} className="flex items-center gap-1 text-muted-foreground text-sm mb-6 hover-elevate">
        <ArrowLeft className="h-4 w-4" />Back to table
      </Link>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-foreground">{data?.title}</h1>
              {isClosed && <Badge variant="secondary" className="text-xs">Closed</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Started {data?.createdAt ? new Date(data.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""}
            </p>
          </div>
          {data?.isHost && !isClosed && (
            <Button size="sm" variant="outline" onClick={() => { if (window.confirm("Close this thread? No new posts will be allowed.")) closeMutation.mutate(); }} disabled={closeMutation.isPending} data-testid="button-close-thread">
              {closeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Lock className="h-3 w-3 mr-1" />Close thread</>}
            </Button>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-3 mb-6">
        {(!data?.posts || data.posts.length === 0) ? (
          <div className="bg-muted/30 border border-border rounded-md p-6 text-center">
            <p className="text-muted-foreground text-sm">No posts yet. Be the first to contribute.</p>
          </div>
        ) : (
          (data.posts || []).map(({ post, user: u }: any) => (
            <div key={post.id} className="bg-card border border-card-border rounded-md p-4" data-testid={`post-${post.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary text-xs font-semibold">{u?.name?.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{u?.name}</p>
                    <p className="text-xs text-muted-foreground">{u?.organisation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground mr-2">
                    {new Date(post.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {post.editedAt && <span className="ml-1 italic">(edited)</span>}
                  </p>
                  {u?.id === user?.id ? (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(post.id, post.content)} data-testid={`button-edit-post-${post.id}`}>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => confirmDelete(post.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-post-${post.id}`}>
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => flagMutation.mutate(post.id)} disabled={flagMutation.isPending} title="Report post" data-testid={`button-flag-post-${post.id}`}>
                      <Flag className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>

              {editingPostId === post.id ? (
                <div className="mt-2">
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={3}
                    className="mb-2 resize-none text-sm"
                    data-testid={`input-edit-post-${post.id}`}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => editMutation.mutate({ id: post.id, content: editContent.trim() })} disabled={!editContent.trim() || editMutation.isPending} data-testid={`button-save-edit-${post.id}`}>
                      {editMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Save</>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingPostId(null)}>
                      <X className="h-3 w-3 mr-1" />Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Composer or status notice */}
      {isClosed ? (
        <div className="bg-muted/30 border border-border rounded-md p-4 text-center" data-testid="notice-thread-closed">
          <Lock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">This thread has been closed. No new posts can be added.</p>
        </div>
      ) : data?.isMember ? (
        <div className="bg-card border border-card-border rounded-md p-4">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your contribution here. Keep it professional, respectful, and relevant to this table."
            rows={4}
            className="mb-3 resize-none"
            data-testid="input-post-content"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Contributions are moderated for professional relevance.</p>
            <Button onClick={() => postMutation.mutate(content.trim())} disabled={!content.trim() || postMutation.isPending} data-testid="button-post-submit">
              {postMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Post
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 border border-border rounded-md p-4 text-center" data-testid="notice-join-to-post">
          <p className="text-sm text-muted-foreground">Join this table to contribute to the discussion.</p>
        </div>
      )}
    </div>
  );
}
