import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Table2, Calendar, MessageSquare, ChevronRight, Users, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: tablesData, isLoading: tablesLoading } = useQuery<any>({
    queryKey: ["/api/tables"],
  });

  const { data: calendarData, isLoading: calLoading } = useQuery<any>({
    queryKey: ["/api/calendar"],
  });

  const myTables = tablesData?.all?.filter((t: any) => tablesData.myTableIds?.includes(t.id)) || [];
  const suggestedTables = tablesData?.all?.filter((t: any) => !tablesData.myTableIds?.includes(t.id)).slice(0, 3) || [];
  const upcomingEvents = calendarData?.events?.slice(0, 3) || [];

  const joinMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const res = await apiRequest("POST", `/api/tables/${tableId}/join`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({ title: "Joined table" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Your working environment</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.name?.split(" ")[0]}.
          {profile?.interests && profile.interests.length > 0 && ` Focused on ${profile.interests.slice(0, 2).join(", ")}.`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suggested tables */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-foreground">Suggested for you</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Based on your focus areas and activity</p>
              </div>
              <Link href="/app/tables">
                <Button variant="ghost" size="sm">View all <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </Link>
            </div>
            {tablesLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-md" />)}</div>
            ) : suggestedTables.length === 0 ? (
              <div className="bg-muted/30 border border-border rounded-md p-5 text-center">
                <p className="text-muted-foreground text-sm">You've joined all available tables. Check back soon for new ones.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestedTables.map((table: any) => (
                  <div key={table.id} className="bg-card border border-card-border rounded-md p-4 hover-elevate" data-testid={`card-table-${table.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground text-sm truncate">{table.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{table.purpose}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(table.tags || []).slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Link href={`/app/tables/${table.id}`}>
                          <Button size="sm" variant="outline" data-testid={`button-preview-${table.id}`}>Preview</Button>
                        </Link>
                        <Button size="sm" onClick={() => joinMutation.mutate(table.id)} disabled={joinMutation.isPending} data-testid={`button-join-${table.id}`}>Join</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* My Tables */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-foreground">My tables</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Your active collaboration spaces</p>
              </div>
            </div>
            {tablesLoading ? (
              <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-14 rounded-md" />)}</div>
            ) : myTables.length === 0 ? (
              <div className="bg-muted/30 border border-border rounded-md p-5 text-center">
                <Table2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm mb-3">You're not in any tables yet. Join a suggested table above.</p>
                <Link href="/app/tables/request">
                  <Button size="sm" variant="outline">
                    <Plus className="h-3 w-3 mr-1" />Request a new table
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myTables.map((table: any) => (
                  <Link key={table.id} href={`/app/tables/${table.id}`}>
                    <div className="flex items-center justify-between bg-card border border-card-border rounded-md px-4 py-3 hover-elevate" data-testid={`card-mytable-${table.id}`}>
                      <div>
                        <p className="text-sm font-medium text-foreground">{table.title}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(table.tags || []).slice(0, 2).map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Upcoming moments */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">Upcoming moments</h2>
              <Link href="/app/moments">
                <Button variant="ghost" size="sm" className="text-xs">See all</Button>
              </Link>
            </div>
            {calLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming moments found.</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event: any) => (
                  <Link key={event.id} href="/app/moments">
                    <div className="bg-card border border-card-border rounded-md px-3 py-3 hover-elevate" data-testid={`card-event-${event.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="bg-primary/10 rounded-md p-1.5 flex-shrink-0 text-center min-w-[40px]">
                          <p className="text-xs text-primary font-semibold">{getMonthLabel(event.startDate)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground leading-tight">{event.title}</p>
                          {event.organiser && <p className="text-xs text-muted-foreground mt-0.5">{event.organiser}</p>}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "My Tables", value: myTables.length, icon: Table2, link: "/app/tables" },
              { label: "Messages", value: 0, icon: MessageSquare, link: "/app/messages" },
            ].map(stat => (
              <Link key={stat.label} href={stat.link}>
                <div className="bg-card border border-card-border rounded-md p-3 text-center hover-elevate" data-testid={`stat-${stat.label}`}>
                  <stat.icon className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
