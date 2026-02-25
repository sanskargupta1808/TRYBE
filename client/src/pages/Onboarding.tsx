import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

const HEALTH_ROLES = [
  "Patient Advocate", "Public Health Professional", "Policymaker / Advisor",
  "Clinical Researcher", "Industry Medical Team", "Health NGO / Foundation",
  "Academic / Educator", "Journalist / Communications", "Other",
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

interface ChatMsg {
  role: "assistant" | "user";
  content: string;
  chips?: string[];
  chipType?: "single" | "multi";
}

interface TableSuggestion {
  tableId: string;
  title: string;
  purpose: string;
  tags: string[];
  reason: string;
}

const STEPS = ["role", "interests", "regions", "goal", "preferences"] as const;
type Step = typeof STEPS[number];

const STEP_QUESTIONS: Record<Step, string> = {
  role: "What role do you play in health? You can pick from the options below or simply describe what you do.",
  interests: "Which disease areas or health topics matter most to your work? Select as many as apply, or describe them in your own words.",
  regions: "Which regions are most relevant to you? Pick from the list or tell me.",
  goal: "Are you working on anything specific right now? A brief note helps me surface relevant tables and moments for you.",
  preferences: "Last question — how would you like to work in TRYBE? Pick your preferred collaboration style and how active you'd like me to be, or just tell me in your own words.",
};

const STEP_CHIPS: Record<Step, string[]> = {
  role: HEALTH_ROLES,
  interests: DISEASE_AREAS,
  regions: REGIONS,
  goal: [],
  preferences: ["Active + Lead", "Balanced + Contribute", "Quiet + Observe"],
};

const STEP_CHIP_TYPE: Record<Step, "single" | "multi"> = {
  role: "single",
  interests: "multi",
  regions: "multi",
  goal: "single",
  preferences: "single",
};

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { refetch, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [profile, setProfile] = useState<Record<string, any>>({
    collaborationMode: "CONTRIBUTE",
    assistantActivityLevel: "BALANCED",
    introPreference: "SUGGEST_ONLY",
  });
  const [done, setDone] = useState(false);
  const [tableSuggestions, setTableSuggestions] = useState<TableSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const currentStep = STEPS[stepIndex] as Step | undefined;

  useEffect(() => {
    const firstName = user?.name?.split(" ")[0] || "";
    const welcome = `Welcome to TRYBE${firstName ? `, ${firstName}` : ""}. I'm here to support your work across the platform. To personalise your experience, I'd like to ask you a few questions. You're in control — answer in your own words or use the quick options below.`;
    setMessages([
      { role: "assistant", content: welcome },
      { role: "assistant", content: STEP_QUESTIONS.role, chips: STEP_CHIPS.role, chipType: "single" },
    ]);
  }, [user?.name]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, processing]);

  const addMessages = (...msgs: ChatMsg[]) => {
    setMessages(prev => [...prev, ...msgs]);
  };

  const advanceToStep = (nextIdx: number) => {
    if (nextIdx >= STEPS.length) {
      finishOnboarding();
      return;
    }
    const step = STEPS[nextIdx] as Step;
    setStepIndex(nextIdx);
    setSelectedChips([]);
    setInputValue("");
    setTimeout(() => {
      addMessages({
        role: "assistant",
        content: STEP_QUESTIONS[step],
        chips: STEP_CHIPS[step].length > 0 ? STEP_CHIPS[step] : undefined,
        chipType: STEP_CHIP_TYPE[step],
      });
    }, 400);
  };

  const processUserMessage = async (userText: string) => {
    if (!currentStep) return;
    addMessages({ role: "user", content: userText });
    setProcessing(true);

    try {
      const res = await apiRequest("POST", "/api/onboarding/process", {
        message: userText,
        currentStep,
        currentProfile: profile,
      });
      const data = await res.json();
      const updatedProfile = data.profile || profile;
      setProfile(updatedProfile);

      if (data.response) {
        addMessages({ role: "assistant", content: data.response });
      }

      await new Promise(r => setTimeout(r, 600));
      advanceToStep(stepIndex + 1);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      advanceToStep(stepIndex + 1);
    } finally {
      setProcessing(false);
    }
  };

  const handleChipClick = (chip: string) => {
    if (!currentStep) return;
    const chipType = STEP_CHIP_TYPE[currentStep];

    if (chipType === "multi") {
      setSelectedChips(prev =>
        prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
      );
    } else {
      processUserMessage(chip);
    }
  };

  const handleSendMultiChips = () => {
    if (selectedChips.length > 0) {
      processUserMessage(selectedChips.join(", "));
    }
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");
    processUserMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const finishOnboarding = async () => {
    setDone(true);
    setSuggestionsLoading(true);
    addMessages({ role: "assistant", content: "Thank you. I'm setting up your workspace and finding tables that match your profile..." });

    try {
      await apiRequest("PUT", "/api/profile", { ...profile, onboardingComplete: true });
      await refetch();
      const res = await apiRequest("POST", "/api/assistant/suggest-tables", { profile });
      const data = await res.json();
      setTableSuggestions(data.suggestions || []);

      const firstName = user?.name?.split(" ")[0] || "";
      const suggCount = data.suggestions?.length || 0;
      const finalMsg = suggCount > 0
        ? `Your workspace is ready, ${firstName}. Based on your profile, I've found ${suggCount} table${suggCount > 1 ? "s" : ""} that align well with your work. You can view them below or explore all tables from the dashboard.`
        : `Your workspace is ready, ${firstName}. You can explore all collaboration tables from the dashboard.`;
      addMessages({ role: "assistant", content: finalMsg });
    } catch (err: any) {
      addMessages({ role: "assistant", content: "Your workspace is set up. You can explore tables from the dashboard." });
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const showChips = lastAssistantMsg?.chips && !processing && !done;
  const isMultiChip = lastAssistantMsg?.chipType === "multi";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border bg-card px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
          <Bot className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">TRYBE Assistant</p>
          <p className="text-xs text-muted-foreground">Setting up your workspace</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-muted/60 border border-border rounded-lg rounded-tl-sm px-4 py-2.5 text-sm text-foreground leading-relaxed" data-testid={`msg-assistant-${i}`}>
                      {msg.content}
                    </div>
                  </div>
                )}
                {msg.role === "user" && (
                  <div className="bg-primary text-primary-foreground rounded-lg rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed" data-testid={`msg-user-${i}`}>
                    {msg.content}
                  </div>
                )}
              </div>
            </div>
          ))}

          {processing && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted/60 border border-border rounded-lg rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {done && !suggestionsLoading && tableSuggestions.length > 0 && (
            <div className="space-y-3 ml-9">
              {tableSuggestions.map((table, i) => (
                <div key={table.tableId} className="border border-border rounded-md p-4 bg-card" data-testid={`card-suggested-table-${i}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{table.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{table.reason}</p>
                      {table.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {table.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="flex-shrink-0 text-xs" onClick={() => navigate(`/app/tables/${table.tableId}`)} data-testid={`button-view-table-${i}`}>
                      View <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {done && !suggestionsLoading && (
            <div className="ml-9 pt-2">
              <Button className="w-full" onClick={() => navigate("/app")} data-testid="button-go-to-dashboard">
                <CheckCircle2 className="h-4 w-4 mr-2" />Go to dashboard
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                You can update your preferences at any time in Settings.
              </p>
            </div>
          )}
        </div>
      </div>

      {!done && (
        <div className="border-t border-border bg-card px-4 py-3 flex-shrink-0">
          <div className="max-w-2xl mx-auto">
            {showChips && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-1.5">
                  {lastAssistantMsg.chips!.map(chip => (
                    <button
                      key={chip}
                      onClick={() => handleChipClick(chip)}
                      className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                        isMultiChip && selectedChips.includes(chip)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                      disabled={processing}
                      data-testid={`chip-${chip}`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                {isMultiChip && selectedChips.length > 0 && (
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">{selectedChips.length} selected</p>
                    <Button size="sm" onClick={handleSendMultiChips} disabled={processing} data-testid="button-send-chips">
                      <Send className="h-3 w-3 mr-1" />Confirm
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentStep === "goal" ? "e.g. coordinating for World Health Day 2026..." : "Type your answer or use the options above..."}
                className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                disabled={processing}
                data-testid="input-onboarding-message"
              />
              <Button size="sm" onClick={handleSend} disabled={!inputValue.trim() || processing} data-testid="button-send-onboarding">
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 text-center">You can type freely — I'll understand natural language.</p>
          </div>
        </div>
      )}
    </div>
  );
}
