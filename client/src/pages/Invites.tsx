import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Send, CheckCircle, Copy, AlertTriangle, Mail, Users, ExternalLink } from "lucide-react";

const APP_ORIGIN = window.location.origin;

function inviteLink(token: string) {
  return `${APP_ORIGIN}/register?invite=${token}`;
}

export default function Invites() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", note: "" });
  const [lastSent, setLastSent] = useState<{ token: string; email: string; emailSent: boolean; emailError?: string } | null>(null);

  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/invites/my"] });
  const invites = data?.invites || [];
  const quota = data?.quota;

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/invites/send", {
        email: form.email,
        note: form.note || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/invites/my"] });
      setLastSent({ token: data.invite.token, email: form.email, emailSent: data.emailSent, emailError: data.emailError });
      setForm({ email: "", note: "" });
    },
    onError: (err: any) => toast({ title: "Could not send invitation", description: err.message, variant: "destructive" }),
  });

  const copyText = (text: string, label = "Copied to clipboard") => {
    navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-foreground heading-rule">Invite a colleague</h1>
        <p className="text-muted-foreground text-sm mt-3 leading-relaxed max-w-lg">
          TRYBE is a trusted environment. Please invite only professionals aligned with its purpose.
          Invitations from active members are confirmed automatically after email verification.
        </p>
      </div>

      {quota && (
        <div className="flex items-center gap-3 bg-muted/30 border border-border rounded-xl px-4 py-3 mb-6 animate-fade-in-up stagger-1" data-testid="status-invite-quota">
          <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            {quota.remaining} of {quota.total} invitations remaining this month
          </p>
        </div>
      )}

      {lastSent && (
        <div className="border border-border rounded-xl mb-6 overflow-hidden animate-fade-in-up" data-testid="panel-invite-sent">
          <div className={`px-4 py-3 flex items-center gap-2 text-sm font-medium ${lastSent.emailSent ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-b border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800"}`}>
            {lastSent.emailSent
              ? <><CheckCircle className="h-4 w-4" /> Invitation sent to {lastSent.email}</>
              : <><AlertTriangle className="h-4 w-4" /> Invitation created but email not sent</>
            }
          </div>
          <div className="p-4 bg-card space-y-3">
            <p className="text-sm text-muted-foreground">
              {lastSent.emailSent
                ? "They'll receive an email with a link to join. Their access will be confirmed automatically."
                : "Share the link below manually. Their access will be confirmed automatically when they register."}
            </p>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Registration link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded border border-border font-mono truncate" data-testid="text-invite-link">
                  {inviteLink(lastSent.token)}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyText(inviteLink(lastSent.token), "Link copied")} data-testid="button-copy-invite-link">
                  <Copy className="h-3.5 w-3.5 mr-1" />Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6 mb-8 animate-fade-in-up stagger-2" data-testid="form-invite">
        <div className="space-y-4">
          <div>
            <Label htmlFor="invite-email" className="mb-1.5">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="colleague@organisation.org"
                className="pl-9"
                data-testid="input-invite-email"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="invite-note" className="mb-1.5">
              Why you're inviting them <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="invite-note"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="e.g. We collaborate on AMR policy and I think they'd benefit from the discussions here."
              rows={3}
              className="resize-none"
              data-testid="input-invite-note"
            />
          </div>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !form.email.trim() || (quota && quota.remaining <= 0)}
            data-testid="button-send-invite"
          >
            {sendMutation.isPending ? (
              <span className="flex items-center gap-2">Sending...</span>
            ) : (
              <><Send className="h-3.5 w-3.5 mr-1.5" />Send invitation</>
            )}
          </Button>
        </div>
      </div>

      <div className="animate-fade-in-up stagger-3">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Your sent invitations</h2>
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-md" />)}</div>
        ) : invites.length === 0 ? (
          <div className="bg-muted/20 border border-border rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">No invitations sent yet. Use the form above to invite a colleague.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invites.map((inv: any) => {
              const isUsed = inv.status === "USED";
              const isExpired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
              const isActive = !isUsed && !isExpired && inv.status !== "REVOKED";
              return (
                <div key={inv.id} className="bg-card border border-border rounded-xl px-4 py-3" data-testid={`row-invite-${inv.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground">{inv.email}</span>
                        {isUsed ? (
                          <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Joined</span>
                        ) : isExpired ? (
                          <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-muted text-muted-foreground">Expired</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Pending</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sent {new Date(inv.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {inv.expiresAt && ` · Expires ${new Date(inv.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                      </p>
                    </div>
                    {isActive && (
                      <Button size="sm" variant="ghost" onClick={() => copyText(inviteLink(inv.token), "Link copied")} data-testid={`button-copy-${inv.id}`}>
                        <Copy className="h-3.5 w-3.5 mr-1" />Copy link
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
