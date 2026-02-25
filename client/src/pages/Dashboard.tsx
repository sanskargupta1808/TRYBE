import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Table2, Calendar, MessageSquare, ChevronRight, Bot, ArrowRight, Repeat2 } from "lucide-react";

function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function FocusSelector({ tables, currentId, onSelect, onClose }: {
  tables: any[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-foreground mb-1">Change your focus</h2>
        <p className="text-sm text-muted-foreground mb-5">Select the table you'd like to work in.</p>
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {tables.map((t: any) => (
            <button
              key={t.id}
              onClick={() => { onSelect(t.id); onClose(); }}
              className={`w-full text-left rounded-md border px-4 py-3 transition-colors ${t.id === currentId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
              data-testid={`button-focus-${t.id}`}
            >
              <p className="text-sm font-medium text-foreground">{t.title}</p>
              {t.purpose && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.purpose}</p>}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="button-close-focus-selector">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [focusTableId, setFocusTableId] = useState<string | null>(() => {
    return localStorage.getItem("trybe_focus_table") || null;
  });
  const [showFocusSelector, setShowFocusSelector] = useState(false);

  const { data: tablesData, isLoading: tablesLoading } = useQuery<any>({ queryKey: ["/api/tables"] });
  const { data: calendarData, isLoading: calLoading } = useQuery<any>({ queryKey: ["/api/calendar"] });
  const { data: convos, isLoading: msgsLoading } = useQuery<any[]>({ queryKey: ["/api/messages"] });

  const myTables = tablesData?.all?.filter((t: any) => tablesData.myTableIds?.includes(t.id)) || [];
  const upcomingEvents = calendarData?.events?.slice(0, 3) || [];
  const recentConvos = (convos || []).slice(0, 3);

  const focusTable = myTables.find((t: any) => t.id === focusTableId) || myTables[0] || null;

  useEffect(() => {
    if (focusTable && focusTable.id !== focusTableId) {
      setFocusTableId(focusTable.id);
      localStorage.setItem("trybe_focus_table", focusTable.id);
    }
  }, [focusTable, focusTableId]);

  const handleSelectFocus = (id: string) => {
    setFocusTableId(id);
    localStorage.setItem("trybe_focus_table", id);
  };

  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <p className="text-muted-foreground text-sm">Welcome back{firstName ? `, ${firstName}` : ""}.</p>
      </div>

      {tablesLoading ? (
        <Skeleton className="h-48 rounded-lg mb-8" />
      ) : focusTable ? (
        <section className="mb-10" data-testid="section-focus">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Your current focus</p>
          <div className="bg-card border border-card-border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground mb-1" data-testid="text-focus-title">{focusTable.title}</h2>
            {focusTable.purpose && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">{focusTable.purpose}</p>
            )}
            <div className="flex flex-wrap gap-2 mb-5">
              {(focusTable.tags || []).slice(0, 3).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={() => navigate(`/app/tables/${focusTable.id}`)} data-testid="button-open-focus">
                Open table <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              {myTables.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setShowFocusSelector(true)} data-testid="button-change-focus">
                  <Repeat2 className="h-3.5 w-3.5 mr-1.5" />Change focus
                </Button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-10" data-testid="section-get-started">
          <div className="bg-card border border-card-border rounded-lg p-8 text-center shadow-sm">
            <Table2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-1">Get started</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-md mx-auto">
              You're not in any tables yet. Join a suggested table or request a new one.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/app/tables">
                <Button data-testid="button-browse-tables">Browse tables</Button>
              </Link>
              <Link href="/app/tables/request">
                <Button variant="outline" data-testid="button-request-table">Request a table</Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm" data-testid="section-my-tables">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">My tables</h3>
            </div>
          </div>
          {tablesLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
          ) : myTables.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tables yet.</p>
          ) : (
            <div className="space-y-1.5">
              {myTables.slice(0, 3).map((t: any) => (
                <Link key={t.id} href={`/app/tables/${t.id}`}>
                  <div className="flex items-center justify-between rounded-md px-2.5 py-2 hover:bg-muted/50 transition-colors" data-testid={`card-mytable-${t.id}`}>
                    <p className="text-sm text-foreground truncate">{t.title}</p>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
          {myTables.length > 3 && (
            <Link href="/app/tables">
              <p className="text-xs text-primary mt-3 hover:underline cursor-pointer" data-testid="link-view-all-tables">View all tables</p>
            </Link>
          )}
        </section>

        <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm" data-testid="section-moments">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Upcoming moments</h3>
            </div>
          </div>
          {calLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No upcoming moments.</p>
          ) : (
            <div className="space-y-1.5">
              {upcomingEvents.map((e: any) => (
                <Link key={e.id} href="/app/moments">
                  <div className="flex items-start gap-2.5 rounded-md px-2.5 py-2 hover:bg-muted/50 transition-colors" data-testid={`card-event-${e.id}`}>
                    <span className="text-xs text-primary font-semibold whitespace-nowrap mt-0.5">{getMonthLabel(e.startDate)}</span>
                    <p className="text-sm text-foreground leading-tight truncate">{e.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link href="/app/moments">
            <p className="text-xs text-primary mt-3 hover:underline cursor-pointer" data-testid="link-view-all-moments">View all moments</p>
          </Link>
        </section>

        <section className="bg-card border border-card-border rounded-lg p-5 shadow-sm" data-testid="section-messages">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Messages</h3>
            </div>
          </div>
          {msgsLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
          ) : recentConvos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No conversations yet. Start one from within a table.</p>
          ) : (
            <div className="space-y-1.5">
              {recentConvos.map((c: any) => (
                <Link key={c.id} href={`/app/messages/${c.id}`}>
                  <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-muted/50 transition-colors" data-testid={`card-convo-${c.id}`}>
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-primary font-medium">{c.otherUser?.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <p className="text-sm text-foreground truncate">{c.otherUser?.name || "Conversation"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {recentConvos.length > 0 && (
            <Link href="/app/messages">
              <p className="text-xs text-primary mt-3 hover:underline cursor-pointer" data-testid="link-view-all-messages">View all messages</p>
            </Link>
          )}
        </section>
      </div>

      <div className="border border-border rounded-lg p-4 flex items-center justify-between bg-muted/20" data-testid="section-assistant-callout">
        <p className="text-sm text-muted-foreground">Want suggestions tailored to your focus?</p>
        <Button variant="ghost" size="sm" onClick={() => {
          const btn = document.querySelector('[data-testid="button-open-assistant"]') as HTMLButtonElement;
          btn?.click();
        }} data-testid="button-callout-assistant">
          <Bot className="h-3.5 w-3.5 mr-1.5" />Ask TRYBE Assistant
        </Button>
      </div>

      {showFocusSelector && myTables.length > 1 && (
        <FocusSelector
          tables={myTables}
          currentId={focusTableId}
          onSelect={handleSelectFocus}
          onClose={() => setShowFocusSelector(false)}
        />
      )}
    </div>
  );
}
