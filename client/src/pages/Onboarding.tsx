import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Bot, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const DISEASE_AREAS = ["Cancer", "Rare Disease", "Diabetes", "Mental Health", "HIV/AIDS", "TB", "AMR", "Cardiovascular", "Respiratory", "NCD Prevention", "Neurology", "Paediatrics"];
const REGIONS = ["Global", "Europe", "North America", "Asia Pacific", "Africa", "Latin America", "Middle East", "South Asia"];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { refetch, user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState({
    interests: [] as string[],
    regions: [] as string[],
    collaborationMode: "CONTRIBUTE",
    assistantActivityLevel: "BALANCED",
    introPreference: "SUGGEST_ONLY",
    currentGoal: "",
  });

  const toggleItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  const steps = [
    {
      question: "Which disease areas matter most to you?",
      content: (
        <div className="flex flex-wrap gap-2">
          {DISEASE_AREAS.map(area => (
            <button key={area} onClick={() => setProfile(p => ({ ...p, interests: toggleItem(p.interests, area) }))}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${profile.interests.includes(area) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
              data-testid={`button-disease-${area}`}>
              {area}
            </button>
          ))}
        </div>
      ),
    },
    {
      question: "Which regions are most relevant to you?",
      content: (
        <div className="flex flex-wrap gap-2">
          {REGIONS.map(region => (
            <button key={region} onClick={() => setProfile(p => ({ ...p, regions: toggleItem(p.regions, region) }))}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${profile.regions.includes(region) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
              data-testid={`button-region-${region}`}>
              {region}
            </button>
          ))}
        </div>
      ),
    },
    {
      question: "Are you working on anything specific right now?",
      content: (
        <Input
          value={profile.currentGoal}
          onChange={e => setProfile(p => ({ ...p, currentGoal: e.target.value }))}
          placeholder="e.g. coordinating for World Health Day 2026..."
          className="max-w-md"
          data-testid="input-goal"
        />
      ),
    },
    {
      question: "How would you like to work in TRYBE?",
      content: (
        <div className="space-y-3 max-w-md">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Assistant activity</p>
            <div className="flex gap-2">
              {["QUIET", "BALANCED", "ACTIVE"].map(level => (
                <button key={level} onClick={() => setProfile(p => ({ ...p, assistantActivityLevel: level }))}
                  className={`px-3 py-1.5 rounded-md text-sm border flex-1 ${profile.assistantActivityLevel === level ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                  data-testid={`button-activity-${level}`}>
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Collaboration mode</p>
            <div className="flex gap-2">
              {["OBSERVE", "CONTRIBUTE", "LEAD"].map(mode => (
                <button key={mode} onClick={() => setProfile(p => ({ ...p, collaborationMode: mode }))}
                  className={`px-3 py-1.5 rounded-md text-sm border flex-1 ${profile.collaborationMode === mode ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                  data-testid={`button-mode-${mode}`}>
                  {mode.charAt(0) + mode.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Introductions</p>
            <div className="flex gap-2">
              {[["SUGGEST_ONLY", "Suggest only"], ["ASK_BEFORE_CONNECT", "Ask before connecting"]].map(([val, label]) => (
                <button key={val} onClick={() => setProfile(p => ({ ...p, introPreference: val }))}
                  className={`px-3 py-1.5 rounded-md text-sm border flex-1 ${profile.introPreference === val ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                  data-testid={`button-intro-${val}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = async () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      setLoading(true);
      try {
        await apiRequest("PUT", "/api/profile", { ...profile, onboardingComplete: true });
        await refetch();
        navigate("/app");
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Let's set up your workspace</h1>
            <p className="text-sm text-muted-foreground">TRYBE Assistant will personalise your experience.</p>
          </div>
        </div>

        {/* Assistant message */}
        <div className="bg-muted/50 rounded-md p-4 mb-6 text-sm text-foreground leading-relaxed">
          {step === 0 && `Welcome to TRYBE, ${user?.name?.split(" ")[0] || ""}. I'm here to support your work across the platform. I'll make suggestions, but you stay in control.`}
          {step === 1 && "Which regions are most relevant to your work?"}
          {step === 2 && "Are you working on anything specific right now? This helps me surface relevant tables and moments."}
          {step === 3 && "Finally — how active would you like me to be? You can change this at any time in Settings."}
        </div>

        {/* Step content */}
        <div className="mb-6">
          <h2 className="font-medium text-foreground mb-4">{steps[step].question}</h2>
          {steps[step].content}
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/40" : "w-3 bg-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{step + 1} of {steps.length}</p>
        </div>

        <div className="flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)}>Back</Button>
          ) : (
            <div />
          )}
          <Button onClick={handleNext} disabled={loading} data-testid={step === steps.length - 1 ? "button-finish" : "button-next"}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {step === steps.length - 1 ? "Go to dashboard" : "Continue"}
            {!loading && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
