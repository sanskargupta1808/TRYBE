import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Loader2, Send, Flag } from "lucide-react";

export default function ThreadDetail() {
  const { tableId, threadId } = useParams<{ tableId: string; threadId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [content, setContent] = useState("");

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
        <h1 className="text-2xl font-semibold text-foreground mb-1">{data?.title}</h1>
        <p className="text-xs text-muted-foreground">
          Started {data?.createdAt ? new Date(data.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""}
        </p>
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
                <p className="text-xs text-muted-foreground">
                  {new Date(post.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      {data?.isMember ? (
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
