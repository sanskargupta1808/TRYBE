import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Loader2, Mail, CheckCircle, AlertTriangle, Link as LinkIcon, ExternalLink } from "lucide-react";

const APP_ORIGIN = window.location.origin;

function inviteLink(token: string) {
  return `${APP_ORIGIN}/register?invite=${token}`;
}

export default function AdminInvites() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ token: string; email?: string; emailSent: boolean; emailError?: string; emailErrorClean?: string } | null>(null);
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
      let emailErrorClean: string | undefined;
      if (data.emailError) {
        if (data.emailError.includes("domain is not verified") || data.emailError.includes("verify a domain")) {
          emailErrorClean = "Sending domain not verified in Resend. Share the link below manually, or verify a domain at resend.com/domains.";
        } else if (data.emailError.includes("testing emails to your own email address")) {
          emailErrorClean = "Resend test mode: email delivery is restricted to the Resend account owner. Share the link below manually, or verify a domain at resend.com/domains.";
        } else {
          emailErrorClean = "Email could not be delivered. Share the link below manually.";
        }
      }
      setLastCreated({ token: data.token, email: data.email, emailSent: data.emailSent, emailError: data.emailError, emailErrorClean });
      setForm({ email: "", recipientName: "", expiresInDays: "30" });
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

  const copyText = (text: string, label = "Copied to clipboard") => {
    navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invite Codes</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate cryptographic invite tokens and send them to recipients</p>
        </div>
        <Button size="sm" onClick={() => { setCreating(v => !v); setLastCreated(null); }} data-testid="button-new-invite">
          <Plus className="h-4 w-4 mr-1" />New invite
        </Button>
      </div>

      {creating && (
        <div className="bg-card border border-border rounded-md p-5 mb-4">
          <h3 className="font-semibold text-foreground mb-1">Create invite</h3>
          <p className="text-xs text-muted-foreground mb-4">
            A cryptographically secure token will be generated. If an email is provided, TRYBE will attempt to send a personalised invitation automatically.
          </p>
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
              <Label className="mb-1.5 text-xs">Email address <span className="text-muted-foreground">(optional — send automatically)</span></Label>
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
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-create-invite">
              {createMutation.isPending ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Plus className="h-3 w-3 mr-1.5" />}
              {form.email ? "Create and send invite" : "Create invite code"}
            </Button>
            <Button variant="ghost" onClick={() => { setCreating(false); setForm({ email: "", recipientName: "", expiresInDays: "30" }); }}>Cancel</Button>
          </div>
        </div>
      )}

      {lastCreated && (
        <div className="border border-border rounded-md mb-6 overflow-hidden" data-testid="panel-invite-created">
          <div className={`px-4 py-3 flex items-center gap-2 text-sm font-medium ${lastCreated.emailSent ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-b border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800"}`}>
            {lastCreated.emailSent
              ? <><CheckCircle className="h-4 w-4" /> Invite created and emailed to {lastCreated.email}</>
              : <><AlertTriangle className="h-4 w-4" /> Invite created — email not sent{lastCreated.emailErrorClean ? `. ${lastCreated.emailErrorClean}` : ""}</>
            }
          </div>
          <div className="p-4 bg-card space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">One-click registration link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded border border-border font-mono truncate" data-testid="text-invite-link">
                  {inviteLink(lastCreated.token)}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyText(inviteLink(lastCreated.token), "Link copied")} data-testid="button-copy-link">
                  <Copy className="h-3.5 w-3.5 mr-1" />Copy link
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Send this link to the recipient. It pre-fills their invite code automatically.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Invite code (manual entry)</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-3 py-2 rounded border border-border font-mono text-sm tracking-widest" data-testid="text-invite-token">
                  {lastCreated.token}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyText(lastCreated.token, "Code copied")} data-testid="button-copy-code">
                  <Copy className="h-3.5 w-3.5 mr-1" />Copy code
                </Button>
              </div>
            </div>
            {!lastCreated.emailSent && lastCreated.email && (
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  To enable automatic email delivery, verify a sending domain at{" "}
                  <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
                    resend.com/domains <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  then set the <code className="bg-muted px-1 rounded text-xs">FROM_EMAIL</code> environment variable.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
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
            const link = inviteLink(invite.token);
            return (
              <div key={invite.id} className="bg-card border border-border rounded-md px-4 py-3" data-testid={`row-invite-${invite.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded shrink-0">{invite.token}</code>
                      <button onClick={() => copyText(invite.token, "Code copied")} className="text-muted-foreground hover:text-foreground shrink-0" title="Copy code" data-testid={`button-copy-code-${invite.id}`}>
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {isActive && (
                        <button onClick={() => copyText(link, "Link copied")} className="text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1 text-xs" title="Copy registration link" data-testid={`button-copy-link-${invite.id}`}>
                          <LinkIcon className="h-3.5 w-3.5" />
                          Copy link
                        </button>
                      )}
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
