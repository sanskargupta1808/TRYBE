import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Table2, Loader2, Lock, Unlock } from "lucide-react";

const COMMON_TAGS = ["rare-disease", "cancer", "diabetes", "mental-health", "HIV/AIDS", "TB", "AMR", "policy", "research", "advocacy", "Global", "Europe", "Africa", "Asia"];

export default function AdminTables() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", purpose: "", tags: [] as string[], requiresApprovalToJoin: true });

  const { data: tables, isLoading } = useQuery<any>({ queryKey: ["/api/tables"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/tables", form);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tables"] });
      setForm({ title: "", purpose: "", tags: [], requiresApprovalToJoin: true });
      setShowForm(false);
      toast({ title: "Table created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("POST", `/api/admin/tables/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tables"] }); toast({ title: "Table status updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleTag = (tag: string) =>
    setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));

  const allTables = (tables as any)?.all || tables || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tables</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage collaboration tables</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)} data-testid="button-new-table">
          <Plus className="h-4 w-4 mr-1" />New table
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-card-border rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-foreground mb-4">Create table directly</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="table-title" className="mb-1.5">Title</Label>
              <Input id="table-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Table title" data-testid="input-admin-table-title" />
            </div>
            <div>
              <Label htmlFor="table-purpose" className="mb-1.5">Purpose <span className="text-muted-foreground font-normal">(max 240 chars)</span></Label>
              <Textarea id="table-purpose" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value.slice(0, 240) }))} rows={3} placeholder="Describe the table's focus and goals" data-testid="input-admin-table-purpose" />
              <p className="text-xs text-muted-foreground mt-1">{form.purpose.length}/240</p>
            </div>
            <div>
              <Label className="mb-1.5">Tags</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_TAGS.map(tag => (
                  <button type="button" key={tag} onClick={() => toggleTag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-md border ${form.tags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                    data-testid={`admin-tag-${tag}`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, requiresApprovalToJoin: !f.requiresApprovalToJoin }))}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md border ${form.requiresApprovalToJoin ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300" : "bg-background border-border text-foreground"}`}
                data-testid="toggle-approval-required">
                {form.requiresApprovalToJoin ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                {form.requiresApprovalToJoin ? "Requires approval to join" : "Open to join"}
              </button>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={!form.title.trim() || !form.purpose.trim() || createMutation.isPending} data-testid="button-create-admin-table">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}Create table
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
      ) : allTables.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-xl p-8 text-center">
          <Table2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No tables yet. Create the first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allTables.map((table: any) => (
            <div key={table.id} className="bg-card border border-card-border rounded-xl p-4" data-testid={`card-admin-table-${table.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-foreground text-sm">{table.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${table.status === "ACTIVE" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>{table.status}</span>
                    {table.requiresApprovalToJoin && <Lock className="h-3 w-3 text-muted-foreground" title="Requires approval" />}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{table.purpose}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(table.tags || []).map((tag: string) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {table.status === "ACTIVE" ? (
                    <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: table.id, status: "ARCHIVED" })} disabled={statusMutation.isPending} data-testid={`button-archive-${table.id}`}>Archive</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: table.id, status: "ACTIVE" })} disabled={statusMutation.isPending} data-testid={`button-activate-${table.id}`}>Activate</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
