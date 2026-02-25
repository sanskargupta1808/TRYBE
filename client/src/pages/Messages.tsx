import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Messages() {
  const { user } = useAuth();
  const { data: conversations, isLoading } = useQuery<any[]>({ queryKey: ["/api/messages"] });

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Messages</h1>
        <div className="bg-muted/30 border border-border rounded-md p-3 mt-3 text-sm text-muted-foreground">
          Private conversations are subject to the Code of Conduct and safety moderation.
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
      ) : !conversations || conversations.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-md p-8 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-foreground mb-2">No private conversations yet</h3>
          <p className="text-muted-foreground text-sm">You can request a conversation from within a table, or be introduced through TRYBE Assistant.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv: any) => {
            const other = conv.userAId === user?.id ? conv.userBId : conv.userAId;
            return (
              <Link key={conv.id} href={`/app/messages/${conv.id}`}>
                <div className="flex items-center justify-between bg-card border border-card-border rounded-md px-4 py-3 hover-elevate" data-testid={`card-conversation-${conv.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Conversation</p>
                      <p className="text-xs text-muted-foreground">{new Date(conv.createdAt).toLocaleDateString("en-GB")}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
