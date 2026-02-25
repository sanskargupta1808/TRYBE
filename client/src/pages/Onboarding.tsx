import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Bot, ChevronRight, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const HEALTH_ROLES = [
  "Patient Advocate",
  "Public Health Professional",
  "Policymaker / Advisor",
  "Clinical Researcher",
  "Industry Medical Team",
  "Health NGO / Foundation",
  "Academic / Educator",
  "Journalist / Communications",
  "Other",
];

const DISEASE_AREAS = [
  "Cancer", "Rare Disease", "Diabetes", "Mental Health", "HIV/AIDS",
  "TB", "AMR", "Cardiovascular", "Respiratory", "NCD Prevention",
  "Neurology", "Paediatrics", "Maternal Health", "Infectious Disease",
];

const REGIONS = [
  "Global", "Europe", "North America", "Asia Pacific",
  "Africa", "Latin America", "Middle East", "South Asia",
];

interface TableSuggestion {
  tableId: string;
  title: string;
  purpose: string;
  tags: string[];
  reason: string;
}

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { refetch, user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [tableSuggestions, setTableSuggestions] = useState<TableSuggestion[]>([]);

  const [profile, setProfile] = useState({
    healthRole: "",
    interests: [] as string[],
    regions: [] as string[],
    collaborationMode: "CONTRIBUTE",
    assistantActivityLevel: "BALANCED",
    introPreference: "SUGGEST_ONLY",
    currentGoal: "",
  });

  const toggleItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  const TOTAL_STEPS = 5;

  const assistantMessages = [
    `Welcome to TRYBE, ${user?.name?.split(" ")[0] || ""}. I'm here to support your work across the platform. To get started, tell me a bit about yourself — I'll use this to personalise your experience. You stay in control at every step.`,
    "Which disease areas or health topics matter most to your work?",
    "Which regions are most relevant to you?",
    "Are you working on anything specific right now? This helps me surface relevant tables and moments.",
    "Finally — how active would you like me to be? You can change this at any time.",
  ];

  const questions = [
    "What role do you play in health?",
    "Which disease areas matter most to you?",
    "Which regions are most relevant to you?",
    "Are you working on anything specific right now?",
    "How would you like to work in TRYBE?",
  ];

  const handleSaveAndSuggest = async () => {
    setLoading(true);
    setSuggestionsLoading(true);
    try {
      await apiRequest("PUT", "/api/profile", { ...profile, onboardingComplete: true });
      await refetch();
      const res = await apiRequest("POST", "/api/assistant/suggest-tables", { profile });
      const data = await res.json();
      setTableSuggestions(data.suggestions || []);
      setStep(TOTAL_STEPS);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setSuggestionsLoading(false);
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      handleSaveAndSuggest();
    }
  };

  const canProceed = () => {
    if (step === 0) return !!profile.healthRole;
    if (step === 1) return profile.interests.length > 0;
    if (step === 2) return profile.regions.length > 0;
    return true;
  };

  if (step === TOTAL_STEPS) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-lg w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Your workspace is ready</h1>
              <p className="text-sm text-muted-foreground">TRYBE Assistant</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-4 mb-6 text-sm text-foreground leading-relaxed">
            {suggestionsLoading
              ? "Finding the most relevant collaboration tables for you..."
              : tableSuggestions.length > 0
                ? `Based on your profile, here are three tables that align well with your work, ${user?.name?.split(" ")[0] || ""}. You can join or browse them now, or explore all tables from the dashboard.`
                : `Your workspace is set up, ${user?.name?.split(" ")[0] || ""}. You can explore all collaboration tables from the dashboard.`
            }
          </div>

          {suggestionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {tableSuggestions.map((table, i) => (
                <div key={table.tableId} className="border border-border rounded-md p-4 bg-background" data-testid={`card-suggested-table-${i}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{table.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{table.reason}</p>
                      {table.tags && table.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {table.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 text-xs"
                      onClick={() => navigate(`/app/tables/${table.tableId}`)}
                      data-testid={`button-view-table-${i}`}
                    >
                      View <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => navigate("/app")}
            data-testid="button-go-to-dashboard"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Go to dashboard
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-3">
            You can update your preferences at any time in Settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Let's set up your workspace</h1>
            <p className="text-sm text-muted-foreground">TRYBE Assistant</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-md p-4 mb-6 text-sm text-foreground leading-relaxed">
          {assistantMessages[step]}
        </div>

        <div className="mb-6">
          <h2 className="font-medium text-foreground mb-4">{questions[step]}</h2>

          {step === 0 && (
            <div className="flex flex-wrap gap-2">
              {HEALTH_ROLES.map(role => (
                <button
                  key={role}
                  onClick={() => setProfile(p => ({ ...p, healthRole: role }))}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${profile.healthRole === role ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                  data-testid={`button-role-${role}`}
                >
                  {role}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-wrap gap-2">
              {DISEASE_AREAS.map(area => (
                <button
                  key={area}
                  onClick={() => setProfile(p => ({ ...p, interests: toggleItem(p.interests, area) }))}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${profile.interests.includes(area) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                  data-testid={`button-disease-${area}`}
                >
                  {area}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-wrap gap-2">
              {REGIONS.map(region => (
                <button
                  key={region}
                  onClick={() => setProfile(p => ({ ...p, regions: toggleItem(p.regions, region) }))}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${profile.regions.includes(region) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                  data-testid={`button-region-${region}`}
                >
                  {region}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <Input
              value={profile.currentGoal}
              onChange={e => setProfile(p => ({ ...p, currentGoal: e.target.value }))}
              placeholder="e.g. coordinating for World Health Day 2026..."
              className="max-w-md"
              data-testid="input-goal"
            />
          )}

          {step === 4 && (
            <div className="space-y-3 max-w-md">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Assistant activity</p>
                <div className="flex gap-2">
                  {[["QUIET", "Quiet"], ["BALANCED", "Balanced"], ["ACTIVE", "Active"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setProfile(p => ({ ...p, assistantActivityLevel: val }))}
                      className={`px-3 py-1.5 rounded-md text-sm border flex-1 ${profile.assistantActivityLevel === val ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                      data-testid={`button-activity-${val}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Collaboration mode</p>
                <div className="flex gap-2">
                  {[["OBSERVE", "Observe"], ["CONTRIBUTE", "Contribute"], ["LEAD", "Lead"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setProfile(p => ({ ...p, collaborationMode: val }))}
                      className={`px-3 py-1.5 rounded-md text-sm border flex-1 ${profile.collaborationMode === val ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                      data-testid={`button-mode-${val}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Introductions</p>
                <div className="flex gap-2">
                  {[["SUGGEST_ONLY", "Suggest only"], ["ASK_BEFORE_CONNECT", "Ask first"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setProfile(p => ({ ...p, introPreference: val }))}
                      className={`px-3 py-1.5 rounded-md text-sm border flex-1 ${profile.introPreference === val ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                      data-testid={`button-intro-${val}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/40" : "w-3 bg-muted"}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{step + 1} of {TOTAL_STEPS}</p>
        </div>

        <div className="flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)} data-testid="button-back">Back</Button>
          ) : (
            <div />
          )}
          <Button
            onClick={handleNext}
            disabled={loading || !canProceed()}
            data-testid={step === TOTAL_STEPS - 1 ? "button-finish" : "button-next"}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {step === TOTAL_STEPS - 1 ? "Find my tables" : "Continue"}
            {!loading && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
