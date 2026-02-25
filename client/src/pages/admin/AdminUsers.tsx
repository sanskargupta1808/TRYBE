import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function AdminUsers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: users = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/users"] });

  const updateMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/action`, { action });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  let filtered = users;
  if (search) filtered = filtered.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.organisation?.toLowerCase().includes(search.toLowerCase()));
  if (statusFilter !== "ALL") filtered = filtered.filter(u => u.status === statusFilter);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">{users.length} member{users.length !== 1 ? "s" : ""} total</p>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or organisation..." className="pl-9" data-testid="input-search-users" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING_APPROVAL">Pending approval</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-md p-6 text-center text-muted-foreground text-sm">No users match your search.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u: any) => (
            <div key={u.id} className="bg-card border border-card-border rounded-md px-4 py-3 flex items-center justify-between gap-3" data-testid={`row-user-${u.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${STATUS_COLORS[u.status] || "bg-muted text-muted-foreground"}`}>{u.status}</span>
                  {u.role === "ADMIN" && <Badge variant="secondary" className="text-xs">Admin</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email} {u.organisation && `· ${u.organisation}`}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {u.status === "PENDING_APPROVAL" && (
                  <>
                    <Button size="sm" onClick={() => updateMutation.mutate({ userId: u.id, action: "APPROVE" })} disabled={updateMutation.isPending} data-testid={`button-approve-${u.id}`}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ userId: u.id, action: "REJECT" })} disabled={updateMutation.isPending} data-testid={`button-reject-${u.id}`}>Reject</Button>
                  </>
                )}
                {u.status === "ACTIVE" && u.role !== "ADMIN" && (
                  <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ userId: u.id, action: "SUSPEND" })} disabled={updateMutation.isPending} data-testid={`button-suspend-${u.id}`}>Suspend</Button>
                )}
                {u.status === "SUSPENDED" && (
                  <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ userId: u.id, action: "REACTIVATE" })} disabled={updateMutation.isPending} data-testid={`button-reactivate-${u.id}`}>Reactivate</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
