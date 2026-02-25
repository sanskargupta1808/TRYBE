import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, User, Bot, RefreshCw } from "lucide-react";

const DISEASE_AREAS = ["Cancer", "Rare Disease", "Diabetes", "Mental Health", "HIV/AIDS", "TB", "AMR", "Cardiovascular", "Respiratory", "NCD Prevention", "Neurology", "Paediatrics"];
const REGIONS = ["Global", "Europe", "North America", "Asia Pacific", "Africa", "Latin America", "Middle East", "South Asia"];

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
      <div>
        <h1 className="text-2xl font-semibold text-foreground mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile and assistant preferences.</p>
      </div>

      {/* Account info */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Account</h2>
        </div>
        <div className="bg-card border border-card-border rounded-md p-4 space-y-3">
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

      {/* Focus areas */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">What I know about you</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">This is used by TRYBE Assistant to tailor suggestions. You can edit or reset at any time.</p>

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

          <div className="flex gap-3">
            <Button onClick={() => saveMutation.mutate(local || current)} disabled={saveMutation.isPending} data-testid="button-save-settings">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save changes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setLocal(null); }} data-testid="button-reset-settings">
              <RefreshCw className="h-3 w-3 mr-1" />Reset
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
