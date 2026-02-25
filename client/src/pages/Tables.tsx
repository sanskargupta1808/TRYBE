import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { Search, Plus, Users, ChevronRight, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Tables() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/tables"] });

  const joinMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const res = await apiRequest("POST", `/api/tables/${tableId}/join`, {});
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/tables"] });
      toast({ title: data.status === "requested" ? "Join request sent" : "Joined table" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const myIds = new Set(data?.myTableIds || []);
  let tables = data?.all || [];

  if (search) tables = tables.filter((t: any) => t.title.toLowerCase().includes(search.toLowerCase()) || t.purpose?.toLowerCase().includes(search.toLowerCase()));
  if (tagFilter) tables = tables.filter((t: any) => (t.tags || []).some((tag: string) => tag.toLowerCase().includes(tagFilter.toLowerCase())));

  const allTags = Array.from(new Set((data?.all || []).flatMap((t: any) => t.tags || []))).slice(0, 10);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold text-foreground heading-rule">Collaboration spaces</h1>
          <p className="text-muted-foreground text-sm mt-2">Focused working areas organised by topic or initiative</p>
        </div>
        <Link href="/app/tables/request">
          <Button size="sm" data-testid="button-request-table">
            <Plus className="h-4 w-4 mr-1" />Request table
          </Button>
        </Link>
      </div>

      {/* Search & filters */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tables you can access…"
            className="pl-9"
            data-testid="input-search-tables"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTagFilter("")}
            className={`text-xs px-2.5 py-1 rounded-md border ${!tagFilter ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
            data-testid="filter-all">All</button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tag === tagFilter ? "" : tag)}
              className={`text-xs px-2.5 py-1 rounded-md border ${tagFilter === tag ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
              data-testid={`filter-${tag}`}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* My Tables */}
      {!search && !tagFilter && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">My spaces</h2>
          {isLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
          ) : (data?.all || []).filter((t: any) => myIds.has(t.id)).length === 0 ? (
            <div className="bg-muted/30 border border-border rounded-md p-8 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08), transparent 70%)' }}>
                <Table2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">You haven't joined any collaboration spaces yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.all || []).filter((t: any) => myIds.has(t.id)).map((table: any) => (
                <Link key={table.id} href={`/app/tables/${table.id}`}>
                  <div className="flex items-center justify-between bg-card border border-card-border rounded-md px-4 py-3 hover-elevate" data-testid={`card-mytable-${table.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{table.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1 items-center">
                        {(table.tags || []).slice(0, 3).map((tag: string) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                        {(table.memberCount ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground ml-1">
                            <Users className="h-3 w-3" />{table.memberCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-3" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* All / Suggested Tables */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          {search || tagFilter ? `Results (${tables.length})` : "Suggested spaces"}
        </h2>
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-md" />)}</div>
        ) : tables.filter((t: any) => !myIds.has(t.id)).length === 0 && !search && !tagFilter ? (
          <div className="bg-muted/30 border border-border rounded-md p-6 text-center">
            <p className="text-muted-foreground text-sm">You're in all available tables! Check back as new ones are added.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tables.filter((t: any) => search || tagFilter ? true : !myIds.has(t.id)).map((table: any) => (
              <div key={table.id} className="bg-card border border-card-border rounded-md p-4 hover-elevate" data-testid={`card-table-${table.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm">{table.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{table.purpose}</p>
                    <div className="flex flex-wrap gap-1 mt-2 items-center">
                      {(table.tags || []).map((tag: string) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                      {(table.memberCount ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground ml-1">
                          <Users className="h-3 w-3" />{table.memberCount} {table.memberCount === 1 ? "member" : "members"}
                        </span>
                      )}
                      {table.requiresApprovalToJoin && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground ml-1">
                          <Lock className="h-3 w-3" />By request
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/app/tables/${table.id}`}>
                      <Button size="sm" variant="outline" data-testid={`button-view-${table.id}`}>View</Button>
                    </Link>
                    {!myIds.has(table.id) && (
                      <Button size="sm" onClick={() => joinMutation.mutate(table.id)} disabled={joinMutation.isPending} data-testid={`button-join-${table.id}`}>
                        {table.requiresApprovalToJoin ? "Request to join" : "Join"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
