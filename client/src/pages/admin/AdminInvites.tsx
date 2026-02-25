import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Loader2 } from "lucide-react";

export default function AdminInvites() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("30");

  const { data: invites = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/invites"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/invites", { expiresInDays: parseInt(expiresInDays) });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/invites"] }); setCreating(false); toast({ title: "Invite code created" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("DELETE", `/api/admin/invites/${id}`, {}); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/invites"] }); toast({ title: "Invite revoked" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast({ title: "Copied to clipboard" }); };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invite Codes</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate and manage invite codes</p>
        </div>
        <Button size="sm" onClick={() => setCreating(v => !v)} data-testid="button-new-invite">
          <Plus className="h-4 w-4 mr-1" />New invite code
        </Button>
      </div>

      {creating && (
        <div className="bg-card border border-card-border rounded-md p-4 mb-6">
          <h3 className="font-medium mb-3">Create invite code</h3>
          <div className="mb-3 max-w-xs">
            <Label className="mb-1.5">Expires in (days)</Label>
            <Input type="number" min={1} max={365} value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} data-testid="input-expires-days" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-create-invite">
              {createMutation.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}Create
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
      ) : (
        <div className="space-y-2">
          {invites.map((invite: any) => {
            const isExpired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
            const isRevoked = invite.status === "REVOKED";
            const isUsed = invite.status === "USED";
            const isActive = !isExpired && !isRevoked && !isUsed;
            return (
              <div key={invite.id} className="bg-card border border-card-border rounded-md px-4 py-3" data-testid={`row-invite-${invite.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{invite.token}</code>
                    <button onClick={() => copyCode(invite.token)} className="text-muted-foreground hover:text-foreground" data-testid={`button-copy-${invite.id}`}>
                      <Copy className="h-3 w-3" />
                    </button>
                    {isActive ? (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">{isUsed ? "Used" : isRevoked ? "Revoked" : "Expired"}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">
                      {invite.expiresAt ? `Expires ${new Date(invite.expiresAt).toLocaleDateString("en-GB")}` : "No expiry"}
                    </p>
                    {isActive && (
                      <Button size="sm" variant="outline" onClick={() => deactivateMutation.mutate(invite.id)} disabled={deactivateMutation.isPending} data-testid={`button-revoke-${invite.id}`}>Revoke</Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
