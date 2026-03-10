import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PasswordInput } from "@/components/PasswordInput";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, User, Bot, RefreshCw, Trash2, KeyRound, AtSign, Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISEASE_AREAS = ["Cancer", "Rare Disease", "Diabetes", "Mental Health", "HIV/AIDS", "TB", "AMR", "Cardiovascular", "Respiratory", "NCD Prevention", "Neurology", "Paediatrics"];
const REGIONS = ["Global", "Europe", "North America", "Asia Pacific", "Africa", "Latin America", "Middle East", "South Asia"];

function ChangePasswordSection() {
  const { toast } = useToast();
  const [pw, setPw] = useState({ current: "", newPw: "", confirm: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: pw.current,
        newPassword: pw.newPw,
      });
    },
    onSuccess: () => {
      toast({ title: "Password updated" });
      setPw({ current: "", newPw: "", confirm: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPw !== pw.confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (pw.newPw.length < 12) {
      toast({ title: "New password must be at least 12 characters", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Change password</h2>
      </div>
      <div className="bg-card border border-card-border rounded-xl p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="currentPassword" className="text-xs mb-1.5">Current password</Label>
            <PasswordInput
              id="currentPassword"
              value={pw.current}
              onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
              required
              data-testid="input-current-password"
            />
          </div>
          <div>
            <Label htmlFor="newPassword" className="text-xs mb-1.5">New password</Label>
            <PasswordInput
              id="newPassword"
              value={pw.newPw}
              onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))}
              required
              data-testid="input-new-password"
            />
            <p className="text-xs text-muted-foreground mt-1">At least 12 characters.</p>
          </div>
          <div>
            <Label htmlFor="confirmNewPassword" className="text-xs mb-1.5">Confirm new password</Label>
            <PasswordInput
              id="confirmNewPassword"
              value={pw.confirm}
              onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
              required
              data-testid="input-confirm-new-password"
            />
          </div>
          <Button type="submit" size="sm" disabled={mutation.isPending} data-testid="button-change-password">
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </section>
  );
}

function NotificationSection() {
  const { toast } = useToast();
  const { isSupported, permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast({ title: "Notifications disabled" });
    } else {
      const ok = await subscribe();
      if (ok) {
        toast({ title: "Notifications enabled", description: "You'll receive push notifications for messages, thread posts, and events." });
      } else if (permission === "denied") {
        toast({ title: "Notifications blocked", description: "Please enable notifications in your browser settings.", variant: "destructive" });
      }
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Push notifications</h2>
      </div>
      <div className="bg-card border border-card-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground mb-3">
          Get notified on your device when someone sends you a message, posts in your threads, or signals interest in your events.
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium text-foreground" data-testid="text-notification-status">
              {isSubscribed ? "Notifications are on" : "Notifications are off"}
            </span>
          </div>
          <Button
            size="sm"
            variant={isSubscribed ? "outline" : "default"}
            onClick={handleToggle}
            data-testid="button-toggle-notifications"
          >
            {isSubscribed ? "Turn off" : "Turn on"}
          </Button>
        </div>
        {permission === "denied" && (
          <p className="text-xs text-destructive mt-2">
            Notifications are blocked in your browser. Go to your browser settings to allow notifications for this site.
          </p>
        )}
      </div>
    </section>
  );
}

function HandleSection() {
  const { toast } = useToast();
  const { user, refetch: refetchAuth } = useAuth();
  const [handle, setHandle] = useState(user?.handle || "");
  const [editing, setEditing] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/handle", { handle: handle.replace(/^@/, "") });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Handle updated" });
      refetchAuth();
      setEditing(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <AtSign className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Your handle</h2>
      </div>
      <div className="bg-card border border-card-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground mb-3">Your public identifier across TRYBE. Other members will see this in tables, messages, and invitations.</p>
        {editing ? (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs mb-1.5">Handle</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  value={handle}
                  onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  className="pl-7"
                  maxLength={30}
                  placeholder="yourhandle"
                  data-testid="input-handle"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">3–30 characters. Letters, numbers, underscores only.</p>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || handle.length < 3} data-testid="button-save-handle">
                {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setHandle(user?.handle || ""); setEditing(false); }} data-testid="button-cancel-handle">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground" data-testid="text-current-handle">@{user?.handle || "—"}</span>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-handle">Change</Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, refetch: refetchAuth } = useAuth();

  const { data: profile, isLoading } = useQuery<any>({ queryKey: ["/api/profile"] });

  const [local, setLocal] = useState<any>(null);

  const current = local || profile || {};

  const saveMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("PUT", "/api/profile", data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/profile"] }); toast({ title: "Settings saved" }); setLocal(null); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const clearMemoryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/profile", {
        ...current,
        profileSnapshot: "",
        currentGoal: "",
        interests: [],
        regions: [],
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      setLocal(null);
      toast({ title: "Assistant memory cleared", description: "OMNI will start fresh on your next conversation." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleItem = (field: string, item: string) => {
    const current_arr = current[field] || [];
    setLocal((p: any) => ({ ...current, ...p, [field]: current_arr.includes(item) ? current_arr.filter((x: string) => x !== item) : [...current_arr, item] }));
  };

  if (isLoading) return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-48 rounded-md" />
    </div>
  );

  return (
    <div className="p-6 max-w-xl mx-auto space-y-8">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-foreground mb-1 heading-rule">Settings</h1>
        <p className="text-muted-foreground text-sm mt-2">Account, assistant preferences, and privacy.</p>
      </div>

      {/* Account info */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Account</h2>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <p className="text-sm font-medium mt-0.5">{user?.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium mt-0.5">{user?.email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Organisation</Label>
              <p className="text-sm font-medium mt-0.5">{user?.organisation || "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <p className="text-sm font-medium mt-0.5">{user?.roleTitle || "—"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <NotificationSection />

      {/* Handle */}
      <HandleSection />

      <ChangePasswordSection />

      {/* Focus areas */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">What I know about you</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">This is used by OMNI to tailor suggestions. You can edit or reset at any time.</p>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">Disease areas</Label>
            <div className="flex flex-wrap gap-2">
              {DISEASE_AREAS.map(area => (
                <button key={area} onClick={() => toggleItem("interests", area)}
                  className={`text-xs px-2.5 py-1 rounded-md border ${(current.interests || []).includes(area) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                  data-testid={`interest-${area}`}>
                  {area}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Regions</Label>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map(region => (
                <button key={region} onClick={() => toggleItem("regions", region)}
                  className={`text-xs px-2.5 py-1 rounded-md border ${(current.regions || []).includes(region) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                  data-testid={`region-${region}`}>
                  {region}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Current focus / goal</Label>
            <Textarea value={current.currentGoal || ""} onChange={e => setLocal((p: any) => ({ ...current, ...p, currentGoal: e.target.value }))} rows={2} placeholder="e.g. planning for World Health Day 2026..." data-testid="input-goal" />
          </div>

          <div>
            <Label className="mb-2 block">Profile snapshot <span className="text-muted-foreground font-normal text-xs">(used by assistant)</span></Label>
            <Textarea value={current.profileSnapshot || ""} onChange={e => setLocal((p: any) => ({ ...current, ...p, profileSnapshot: e.target.value }))} rows={3} placeholder="Brief description of your work and focus..." data-testid="input-snapshot" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-2 block text-xs">Assistant activity</Label>
              <div className="flex flex-col gap-1">
                {["QUIET", "BALANCED", "ACTIVE"].map(level => (
                  <button key={level} onClick={() => setLocal((p: any) => ({ ...current, ...p, assistantActivityLevel: level }))}
                    className={`text-xs px-2 py-1.5 rounded-md border text-left ${current.assistantActivityLevel === level ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                    data-testid={`activity-${level}`}>
                    {level.charAt(0) + level.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-xs">Collaboration mode</Label>
              <div className="flex flex-col gap-1">
                {["OBSERVE", "CONTRIBUTE", "LEAD"].map(mode => (
                  <button key={mode} onClick={() => setLocal((p: any) => ({ ...current, ...p, collaborationMode: mode }))}
                    className={`text-xs px-2 py-1.5 rounded-md border text-left ${current.collaborationMode === mode ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                    data-testid={`mode-${mode}`}>
                    {mode.charAt(0) + mode.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-xs">Introductions</Label>
              <div className="flex flex-col gap-1">
                {[["SUGGEST_ONLY", "Suggest only"], ["ASK_BEFORE_CONNECT", "Ask before"]].map(([val, label]) => (
                  <button key={val} onClick={() => setLocal((p: any) => ({ ...current, ...p, introPreference: val }))}
                    className={`text-xs px-2 py-1.5 rounded-md border text-left ${current.introPreference === val ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                    data-testid={`intro-${val}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Button onClick={() => saveMutation.mutate(local || current)} disabled={saveMutation.isPending} data-testid="button-save-settings">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save changes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setLocal(null); }} data-testid="button-discard-settings">
              <RefreshCw className="h-3 w-3 mr-1" />Discard changes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive ml-auto"
              onClick={() => { if (window.confirm("Clear all assistant memory? This will reset your profile snapshot, interests, regions, and current goal. This cannot be undone.")) clearMemoryMutation.mutate(); }}
              disabled={clearMemoryMutation.isPending}
              data-testid="button-clear-memory"
            >
              {clearMemoryMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Clear assistant memory
            </Button>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Privacy</h2>
        </div>
        <div className="bg-card border border-card-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Deleting your account removes your data from TRYBE systems, subject to legal requirements.
          </p>
        </div>
      </section>
    </div>
  );
}
