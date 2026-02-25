import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Loader2, Mail, CheckCircle, AlertCircle } from "lucide-react";

export default function AdminInvites() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", recipientName: "", expiresInDays: "30" });

  const { data: invites = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/invites"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/invites", {
        email: form.email || undefined,
        recipientName: form.recipientName || undefined,
        expiresInDays: parseInt(form.expiresInDays),
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setCreating(false);
      setForm({ email: "", recipientName: "", expiresInDays: "30" });
      if (data.emailSent) {
        toast({ title: "Invite created and emailed", description: `Sent to ${data.email}` });
      } else if (form.email && !data.emailSent) {
        toast({ title: "Invite created", description: "Email could not be sent — copy the code manually.", variant: "destructive" });
      } else {
        toast({ title: "Invite code created", description: "Copy and share the code manually." });
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/invites/${id}`, {});
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/invites"] }); toast({ title: "Invite revoked" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast({ title: "Copied to clipboard" }); };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invite Codes</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate cryptographic invite tokens and send them directly to recipients</p>
        </div>
        <Button size="sm" onClick={() => setCreating(v => !v)} data-testid="button-new-invite">
          <Plus className="h-4 w-4 mr-1" />New invite
        </Button>
      </div>

      {creating && (
        <div className="bg-card border border-card-border rounded-md p-5 mb-6">
          <h3 className="font-semibold text-foreground mb-1">Create invite</h3>
          <p className="text-xs text-muted-foreground mb-4">A cryptographically secure token will be generated. If an email is provided, the invite is sent automatically with a welcome message.</p>
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 text-xs">Recipient name <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="Dr. Jane Smith" data-testid="input-recipient-name" />
              </div>
              <div>
                <Label className="mb-1.5 text-xs">Expires in (days)</Label>
                <Input type="number" min={1} max={365} value={form.expiresInDays} onChange={e => setForm(f => ({ ...f, expiresInDays: e.target.value }))} data-testid="input-expires-days" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 text-xs">Email address <span className="text-muted-foreground">(send automatically)</span></Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="colleague@who.int"
                  className="pl-9"
                  data-testid="input-invite-email"
                />
              </div>
              {form.email && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  A TRYBE welcome email with their personal invite link will be sent to this address.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-create-invite">
              {createMutation.isPending ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Mail className="h-3 w-3 mr-1.5" />}
              {form.email ? "Create and send invite" : "Create invite code"}
            </Button>
            <Button variant="ghost" onClick={() => { setCreating(false); setForm({ email: "", recipientName: "", expiresInDays: "30" }); }}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
      ) : invites.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-md p-6 text-center">
          <p className="text-muted-foreground text-sm">No invite codes yet. Create one above to get started.</p>
        </div>
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded shrink-0">{invite.token}</code>
                      <button onClick={() => copyCode(invite.token)} className="text-muted-foreground hover:text-foreground shrink-0" title="Copy code" data-testid={`button-copy-${invite.id}`}>
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {isActive ? (
                        <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-muted text-muted-foreground">{isUsed ? "Used" : isRevoked ? "Revoked" : "Expired"}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {invite.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {invite.email}
                        </span>
                      )}
                      {invite.expiresAt && (
                        <span>Expires {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <Button size="sm" variant="outline" onClick={() => deactivateMutation.mutate(invite.id)} disabled={deactivateMutation.isPending} data-testid={`button-revoke-${invite.id}`}>Revoke</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
