import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, ChevronRight, Plus, X, Search, Loader2, Users, TableProperties } from "lucide-react";

export default function Messages() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showNewConv, setShowNewConv] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [startingWith, setStartingWith] = useState<string | null>(null);

  const { data: conversations, isLoading } = useQuery<any[]>({ queryKey: ["/api/messages"] });

  const { data: contacts, isLoading: contactsLoading } = useQuery<any[]>({
    queryKey: ["/api/messages/eligible-contacts"],
    enabled: showNewConv,
  });

  const startConvMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiRequest("POST", "/api/messages", { targetUserId });
      return res.json();
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
      setShowNewConv(false);
      setContactSearch("");
      setStartingWith(null);
      navigate(`/app/messages/${conv.id}`);
    },
    onError: (err: any) => {
      setStartingWith(null);
      toast({ title: "Cannot start conversation", description: err.message, variant: "destructive" });
    },
  });

  const handleStartConv = (contact: any) => {
    setStartingWith(contact.id);
    startConvMutation.mutate(contact.id);
  };

  const filteredContacts = (contacts || []).filter((c: any) =>
    !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase()) || c.organisation?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const existingPartnerIds = new Set((conversations || []).map((conv: any) =>
    conv.userAId === user?.id ? conv.userBId : conv.userAId
  ));
  const newContacts = filteredContacts.filter((c: any) => !existingPartnerIds.has(c.id));

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Messages</h1>
          <p className="text-muted-foreground text-sm mt-1">Private conversations with table members</p>
        </div>
        <Button size="sm" onClick={() => setShowNewConv(v => !v)} data-testid="button-new-conversation">
          {showNewConv ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showNewConv ? "Cancel" : "New conversation"}
        </Button>
      </div>

      <div className="bg-muted/30 border border-border rounded-md p-3 mb-6 text-sm text-muted-foreground">
        You can message people you share a table with. All conversations are subject to the Code of Conduct and safety moderation.
      </div>

      {/* New conversation picker */}
      {showNewConv && (
        <div className="bg-card border border-card-border rounded-md p-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Start a new conversation</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
              placeholder="Search by name or organisation..."
              className="pl-9"
              data-testid="input-contact-search"
            />
          </div>
          {contactsLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
          ) : newContacts.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {contactSearch ? "No matches found." : "No new contacts available. Join tables to meet more collaborators."}
              </p>
              {!contactSearch && (
                <Link href="/app/tables">
                  <Button size="sm" variant="outline" className="mt-3">Browse Tables</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {newContacts.map((contact: any) => {
                const tables: string[] = contact.sharedTables || [];
                const contextLabel = contact.isExistingContact
                  ? "Existing conversation"
                  : tables.length === 1
                  ? `via ${tables[0]}`
                  : tables.length > 1
                  ? `via ${tables[0]} +${tables.length - 1} more`
                  : null;
                return (
                  <div key={contact.id} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2.5" data-testid={`contact-${contact.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary text-xs font-medium">{contact.name?.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                        {contact.organisation && <p className="text-xs text-muted-foreground truncate">{contact.organisation}</p>}
                        {contextLabel && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" data-testid={`contact-context-${contact.id}`}>
                            <TableProperties className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{contextLabel}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 h-7 ml-2"
                      onClick={() => handleStartConv(contact)}
                      disabled={startingWith === contact.id}
                      data-testid={`button-start-conv-${contact.id}`}
                    >
                      {startingWith === contact.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Message"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Conversation list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
      ) : !conversations || conversations.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-md p-8 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium text-foreground mb-2">No conversations yet</h3>
          <p className="text-muted-foreground text-sm">Start a conversation with a table member using the button above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv: any) => {
            const other = conv.otherUser;
            return (
              <Link key={conv.id} href={`/app/messages/${conv.id}`}>
                <div className="flex items-center justify-between bg-card border border-card-border rounded-md px-4 py-3 hover-elevate" data-testid={`card-conversation-${conv.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-sm font-medium">{other?.name?.charAt(0) || "?"}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{other?.name || "Member"}</p>
                      {other?.organisation && <p className="text-xs text-muted-foreground truncate">{other.organisation}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-xs text-muted-foreground">{new Date(conv.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
