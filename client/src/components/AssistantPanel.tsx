import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Bot, Send, ChevronRight, ChevronDown, Loader2, Copy, Check, FileText, AlignLeft, Lightbulb, CalendarDays, MessageSquare, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface SuggestedAction {
  type: string;
  label: string;
  tableId?: string;
  threadId?: string;
  url?: string;
  userId?: string;
}

interface Nudge {
  type: string;
  message: string;
  tableId?: string;
  eventTitle?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  summaryContent?: string | Record<string, any>;
  reflectionContent?: string | Record<string, any>;
  milestoneContent?: string | Record<string, any>;
  draftContent?: string;
  suggestedActions?: SuggestedAction[];
}

interface AssistantPanelProps {
  onClose?: () => void;
  onDraft?: (text: string) => void;
}

function parseContext(location: string) {
  const parts = location.split("/").filter(Boolean);
  let tableId: string | undefined;
  let threadId: string | undefined;

  const tableIdx = parts.indexOf("tables");
  if (tableIdx !== -1 && parts[tableIdx + 1]) tableId = parts[tableIdx + 1];

  const threadIdx = parts.indexOf("threads");
  if (threadIdx !== -1 && parts[threadIdx + 1]) threadId = parts[threadIdx + 1];

  return { tableId, threadId };
}

function getQuickActions(location: string): string[] {
  if (location.includes("/threads/")) return [
    "Summarise this discussion",
    "What's happening here?",
    "Is there alignment forming?",
    "Help me draft a reply",
  ];
  if (location.includes("/tables/")) return [
    "What is this table about?",
    "What are we missing?",
    "Suggest a discussion to start",
    "Help me prepare for an upcoming milestone",
  ];
  if (location.includes("/moments")) return [
    "Which moments are most relevant to me?",
    "Help me prepare for an event",
    "What is happening in my focus areas?",
    "Suggest tables for upcoming events",
  ];
  if (location.includes("/messages")) return [
    "Help me draft a message",
    "How should I introduce myself?",
    "Suggest a professional tone for this",
    "What should I include?",
  ];
  if (location.includes("/invites")) return [
    "How do invitations work?",
    "Who should I invite?",
    "What happens after I send an invite?",
    "How many invites do I have left?",
  ];
  return [
    "Suggest relevant tables for me",
    "Show upcoming health moments",
    "What should I focus on today?",
    "Help me prepare for an upcoming event",
  ];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="button-copy-content">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true, testId }: {
  title: string;
  icon: typeof AlignLeft;
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2 border border-border rounded-md bg-background overflow-hidden" data-testid={testId}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 bg-muted/50 border-b border-border hover:bg-muted/70 transition-colors"
        data-testid={`${testId}-toggle`}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Icon className="h-3 w-3" />
          {title}
        </div>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="px-3 py-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
          {children}
        </div>
      )}
    </div>
  );
}

function normalizeStructuredContent(content: string | Record<string, any>): string {
  if (typeof content === "string") return content;
  const lines: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    lines.push(`**${key}**`);
    if (Array.isArray(value)) {
      value.forEach(item => lines.push(`- ${item}`));
    } else if (typeof value === "string") {
      lines.push(value);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function StructuredContent({ content, copyable = true }: { content: string | Record<string, any>; copyable?: boolean }) {
  const normalized = normalizeStructuredContent(content);
  const sections = normalized.split(/\*\*([^*]+)\*\*/g);
  if (sections.length <= 1) {
    return (
      <div>
        <div className="whitespace-pre-wrap">{normalized}</div>
        {copyable && (
          <div className="mt-2 pt-2 border-t border-border">
            <CopyButton text={normalized} />
          </div>
        )}
      </div>
    );
  }

  const parsed: { heading: string; body: string }[] = [];
  for (let i = 1; i < sections.length; i += 2) {
    parsed.push({
      heading: sections[i].trim(),
      body: (sections[i + 1] || "").trim(),
    });
  }

  return (
    <div className="space-y-2">
      {parsed.map((section, idx) => (
        <div key={idx}>
          <p className="text-xs font-semibold text-foreground mb-0.5">{section.heading}</p>
          <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{section.body}</div>
        </div>
      ))}
      {copyable && (
        <div className="mt-2 pt-2 border-t border-border">
          <CopyButton text={normalized} />
        </div>
      )}
    </div>
  );
}

export function AssistantPanel({ onClose, onDraft }: AssistantPanelProps) {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "How can I support your work today? I can suggest tables, surface upcoming health moments, help draft messages, summarise discussions, provide strategic reflections, or help prepare for milestones.",
      suggestedActions: [
        { type: "NAVIGATE", label: "Browse Tables", url: "/app/tables" },
        { type: "NAVIGATE", label: "View Milestones", url: "/app/moments" },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [focusReviewDismissed, setFocusReviewDismissed] = useState(false);

  const { tableId, threadId } = parseContext(location);
  const quickActions = getQuickActions(location);

  const { data: nudgeData } = useQuery<{ nudges: Nudge[]; focusReviewDue: boolean }>({
    queryKey: ["/api/assistant/nudges"],
    refetchInterval: 300000,
    staleTime: 60000,
  });

  const dismissFocusReview = useMutation({
    mutationFn: async (action: "dismiss" | "update") => {
      await apiRequest("POST", "/api/assistant/dismiss-focus-review");
      if (action === "update") {
        navigate("/app/settings");
      }
    },
    onSuccess: () => {
      setFocusReviewDismissed(true);
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/nudges"] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await apiRequest("POST", "/api/assistant", {
        message,
        history,
        context: { page: location, tableId, threadId },
      });
      return res.json();
    },
    onSuccess: (data) => {
      const hasStructured = data.reflectionContent || data.milestoneContent || data.summaryContent || data.draftContent;
      const fallbackText = hasStructured
        ? (data.assistantText || "Here is what I found.")
        : (data.assistantText || "I'm here to support your work.");
      setMessages(prev => [...prev, {
        role: "assistant",
        content: fallbackText,
        summaryContent: data.summaryContent,
        reflectionContent: data.reflectionContent,
        milestoneContent: data.milestoneContent,
        draftContent: data.draftContent,
        suggestedActions: data.suggestedActions || [],
      }]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having trouble responding right now. Please try again in a moment.",
      }]);
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: "user", content: input }]);
    sendMessage.mutate(input);
    setInput("");
  };

  const handleQuickAction = (action: string) => {
    setMessages(prev => [...prev, { role: "user", content: action }]);
    sendMessage.mutate(action);
  };

  const handleSuggestedAction = useCallback((action: SuggestedAction) => {
    if (action.url) { navigate(action.url); return; }
    if (action.type === "SUGGEST_JOIN_TABLE" && action.tableId) { navigate(`/app/tables/${action.tableId}`); return; }
    if (action.type === "SUGGEST_SUMMARISE_THREAD" && action.threadId) { navigate(`/app/threads/${action.threadId}`); return; }
  }, [navigate]);

  const handleUseDraft = (draft: string) => {
    if (onDraft) {
      onDraft(draft);
      toast({ title: "Draft added to compose box" });
    } else {
      navigator.clipboard.writeText(draft);
      toast({ title: "Draft copied to clipboard" });
    }
  };

  const handleNudgeAction = (nudge: Nudge) => {
    setNudgeDismissed(true);
    if (nudge.tableId) {
      navigate(`/app/tables/${nudge.tableId}`);
    } else if (nudge.eventTitle) {
      handleQuickAction(`Help me prepare for ${nudge.eventTitle}`);
    }
  };

  const activeNudge = !nudgeDismissed && nudgeData?.nudges?.[0];
  const showFocusReview = !focusReviewDismissed && nudgeData?.focusReviewDue;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">TRYBE Assistant <span className="text-muted-foreground font-normal">OMNI</span></p>
            <p className="text-xs text-muted-foreground">Suggestions only. You stay in control.</p>
          </div>
        </div>
        {onClose && (
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-assistant">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4">
          {activeNudge && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3" data-testid="block-nudge">
              <div className="flex items-start gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-foreground leading-relaxed">{activeNudge.message}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleNudgeAction(activeNudge)}
                      className="text-xs text-primary font-medium hover:underline"
                      data-testid="button-nudge-action"
                    >
                      {activeNudge.tableId ? "Go to space" : "Prepare"}
                    </button>
                    <button
                      onClick={() => setNudgeDismissed(true)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      data-testid="button-nudge-dismiss"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showFocusReview && (
            <div className="rounded-md border border-border bg-muted/50 p-3" data-testid="block-focus-review">
              <div className="flex items-start gap-2">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-foreground leading-relaxed">Has your professional focus shifted recently?</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => dismissFocusReview.mutate("update")}
                      className="text-xs text-primary font-medium hover:underline"
                      data-testid="button-focus-update"
                    >
                      Update interests
                    </button>
                    <button
                      onClick={() => dismissFocusReview.mutate("dismiss")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      data-testid="button-focus-keep"
                    >
                      Keep current settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-md px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {msg.content}
                </div>
              </div>

              {msg.reflectionContent && (
                <CollapsibleSection title="Strategic Reflection" icon={Lightbulb} testId={`block-reflection-${i}`}>
                  <StructuredContent content={msg.reflectionContent} />
                </CollapsibleSection>
              )}

              {msg.milestoneContent && (
                <CollapsibleSection title="Milestone Preparation" icon={CalendarDays} testId={`block-milestone-${i}`}>
                  <StructuredContent content={msg.milestoneContent} />
                </CollapsibleSection>
              )}

              {msg.summaryContent && (
                <CollapsibleSection title="Summary" icon={AlignLeft} testId={`block-summary-${i}`}>
                  <StructuredContent content={msg.summaryContent} />
                </CollapsibleSection>
              )}

              {msg.draftContent && (
                <div className="mt-2 border border-border rounded-md bg-background overflow-hidden" data-testid={`block-draft-${i}`}>
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <FileText className="h-3 w-3" />
                      Draft — review before using
                    </div>
                    <CopyButton text={msg.draftContent} />
                  </div>
                  <div className="px-3 py-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {msg.draftContent}
                  </div>
                  <div className="px-3 py-2 border-t border-border">
                    <button
                      onClick={() => handleUseDraft(msg.draftContent!)}
                      className="text-xs text-primary hover-elevate font-medium"
                      data-testid={`button-use-draft-${i}`}
                    >
                      Use this draft
                    </button>
                  </div>
                </div>
              )}

              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.suggestedActions.map((action, j) => (
                    <button
                      key={j}
                      onClick={() => handleSuggestedAction(action)}
                      className="flex items-center gap-1.5 text-xs text-primary hover-elevate rounded-sm px-2 py-1 bg-primary/5 w-full text-left"
                      data-testid={`button-assistant-action-${j}`}
                    >
                      <ChevronRight className="h-3 w-3 flex-shrink-0" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {sendMessage.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-md px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="px-4 py-2 border-t border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground mb-1.5">Quick actions</p>
        <div className="flex flex-wrap gap-1">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              className="text-xs rounded-sm px-2 py-1 bg-muted text-muted-foreground hover-elevate"
              data-testid={`button-quick-${action.slice(0, 12).replace(/\s/g, "-")}`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground mb-2">
          I suggest — you decide. Nothing happens without your confirmation.
        </p>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask anything..."
            className="min-h-[60px] resize-none text-sm"
            data-testid="input-assistant-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sendMessage.isPending || !input.trim()}
            data-testid="button-assistant-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
