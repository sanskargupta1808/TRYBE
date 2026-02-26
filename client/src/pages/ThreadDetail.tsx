import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Loader2, Send, Flag, Pencil, Trash2, Lock, X, Check, Sparkles, Paperclip, Image as ImageIcon, AlertTriangle } from "lucide-react";

export default function ThreadDetail() {
  const { tableId, threadId } = useParams<{ tableId: string; threadId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [showGenPrompt, setShowGenPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/threads", threadId],
    queryFn: async () => { const res = await fetch(`/api/threads/${threadId}`, { credentials: "include" }); if (!res.ok) throw new Error("Not found"); return res.json(); },
    refetchInterval: 15000,
  });

  const postMutation = useMutation({
    mutationFn: async (payload: { content: string; fileUrl?: string; fileName?: string; fileMimeType?: string }) => {
      const res = await apiRequest("POST", `/api/threads/${threadId}/posts`, payload);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/threads", threadId] }); setContent(""); },
    onError: (err: any) => toast({ title: "Could not post", description: err.message, variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = file.type.startsWith("image/") || file.type.startsWith("video/");
    if (!allowed) {
      toast({ title: "Only images and videos are supported", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large (max 50MB)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      postMutation.mutate({
        content: content.trim(),
        fileUrl: result.url,
        fileName: result.fileName,
        fileMimeType: result.mimeType,
      });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

  const generateDraft = async () => {
    setGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/ai/generate-post", { threadId, prompt: generatePrompt.trim() || undefined });
      const { content: generated } = await res.json();
      setContent(generated);
      setShowGenPrompt(false);
      setGeneratePrompt("");
      toast({ title: "Draft generated", description: "Review and edit before posting." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
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
      <Link href={`/app/tables/${tableId}`} className="flex items-center gap-1 text-muted-foreground text-sm mb-6 hover-elevate animate-fade-in">
        <ArrowLeft className="h-4 w-4" />Back to table
      </Link>

      <div className="mb-6 animate-fade-in-up">
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
      <div className="space-y-3 mb-6 animate-fade-in-up stagger-1">
        {(!data?.posts || data.posts.length === 0) ? (
          <div className="bg-muted/30 border border-border rounded-xl p-6 text-center">
            <p className="text-muted-foreground text-sm">No posts yet. Be the first to contribute.</p>
          </div>
        ) : (
          (data.posts || []).map(({ post, user: u }: any) => (
            <div key={post.id} className="bg-card border border-card-border rounded-xl p-4" data-testid={`post-${post.id}`}>
              {post.moderationStatus === "REMOVED" ? (
                <div className="flex items-center gap-2 text-muted-foreground py-1">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm italic">This post was removed by a moderator for violating the code of conduct.</p>
                </div>
              ) : (
              <>
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
                <div>
                  {post.content && <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>}
                  {post.fileUrl && post.fileMimeType?.startsWith("image/") && (
                    <img
                      src={post.fileUrl}
                      alt={post.fileName || "Image"}
                      className="mt-2 rounded-lg max-w-full max-h-80 object-contain cursor-pointer border border-border"
                      onClick={() => window.open(post.fileUrl, "_blank")}
                      data-testid={`img-post-${post.id}`}
                    />
                  )}
                  {post.fileUrl && post.fileMimeType?.startsWith("video/") && (
                    <video
                      src={post.fileUrl}
                      controls
                      className="mt-2 rounded-lg max-w-full max-h-80 border border-border"
                      data-testid={`video-post-${post.id}`}
                    />
                  )}
                  {post.fileUrl && !post.fileMimeType?.startsWith("image/") && !post.fileMimeType?.startsWith("video/") && (
                    <a href={post.fileUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-sm text-primary hover:underline" data-testid={`file-post-${post.id}`}>
                      <Paperclip className="h-3.5 w-3.5" />{post.fileName || "Attachment"}
                    </a>
                  )}
                </div>
              )}
              </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Composer or status notice */}
      {isClosed ? (
        <div className="bg-muted/30 border border-border rounded-xl p-4 text-center" data-testid="notice-thread-closed">
          <Lock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-sm text-muted-foreground">This thread has been closed. No new posts can be added.</p>
        </div>
      ) : data?.isMember ? (
        <div className="bg-card border border-card-border rounded-xl p-4">
          {showGenPrompt && (
            <div className="mb-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Optional: give AI a direction for your draft</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatePrompt}
                  onChange={e => setGeneratePrompt(e.target.value)}
                  placeholder="e.g. focus on African regional context, or policy implications..."
                  className="flex-1 text-sm bg-background border border-border rounded-md px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={e => { if (e.key === "Enter") generateDraft(); }}
                  data-testid="input-generate-prompt"
                />
                <Button size="sm" onClick={generateDraft} disabled={generating} data-testid="button-generate-draft">
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowGenPrompt(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your contribution here. Keep it professional, respectful, and relevant to this table."
            rows={4}
            className="mb-3 resize-none"
            data-testid="input-post-content"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Moderated for professional relevance.</p>
              {!showGenPrompt && (
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setShowGenPrompt(true)} disabled={generating} data-testid="button-show-generate">
                  <Sparkles className="h-3 w-3" />Draft with AI
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileUpload}
                data-testid="input-thread-file"
              />
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach image or video" data-testid="button-attach-file">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button onClick={() => postMutation.mutate({ content: content.trim() })} disabled={!content.trim() || postMutation.isPending} data-testid="button-post-submit">
                {postMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Post
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-muted/30 border border-border rounded-xl p-4 text-center" data-testid="notice-join-to-post">
          <p className="text-sm text-muted-foreground">Join this table to contribute to the discussion.</p>
        </div>
      )}
    </div>
  );
}
