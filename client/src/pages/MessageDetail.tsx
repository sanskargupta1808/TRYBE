import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Send, Loader2 } from "lucide-react";

export default function MessageDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [content, setContent] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/messages", id],
    queryFn: async () => { const res = await fetch(`/api/messages/${id}`, { credentials: "include" }); if (!res.ok) throw new Error("Not found"); return res.json(); },
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: async (c: string) => { const res = await apiRequest("POST", `/api/messages/${id}/send`, { content: c }); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/messages", id] }); setContent(""); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-64 rounded-md" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col h-full" style={{ minHeight: "calc(100vh - 60px)" }}>
      <Link href="/app/messages" className="flex items-center gap-1 text-muted-foreground text-sm mb-4 hover-elevate">
        <ArrowLeft className="h-4 w-4" />Back to messages
      </Link>

      <div className="flex-1 space-y-3 mb-4">
        {(!data?.messages || data.messages.length === 0) ? (
          <div className="bg-muted/30 border border-border rounded-md p-5 text-center">
            <p className="text-muted-foreground text-sm">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          (data.messages || []).map(({ message, sender }: any) => {
            const isMe = sender?.id === user?.id;
            return (
              <div key={message.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`} data-testid={`message-${message.id}`}>
                <div className={`max-w-[75%] rounded-md px-4 py-2.5 ${isMe ? "bg-primary text-primary-foreground" : "bg-card border border-card-border text-foreground"}`}>
                  {!isMe && <p className="text-xs font-medium mb-1 opacity-70">{sender?.name}</p>}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(message.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-card border border-card-border rounded-md p-3">
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write a message..."
          rows={2}
          className="resize-none mb-2"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && content.trim()) { e.preventDefault(); sendMutation.mutate(content.trim()); } }}
          data-testid="input-message"
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Subject to the Code of Conduct and safety moderation.</p>
          <Button size="sm" onClick={() => sendMutation.mutate(content.trim())} disabled={!content.trim() || sendMutation.isPending} data-testid="button-send-message">
            {sendMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
