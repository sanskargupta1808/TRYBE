import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Bot, Send, ChevronRight, Loader2, Copy, Check, FileText, AlignLeft } from "lucide-react";
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

interface Message {
  role: "user" | "assistant";
  content: string;
  summaryContent?: string;
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
    "Help me draft a reply",
    "What are the key points so far?",
    "Show upcoming health moments",
  ];
  if (location.includes("/tables/")) return [
    "What is this table about?",
    "Suggest a discussion to start",
    "Help me draft an introduction",
    "Show upcoming health moments",
  ];
  if (location.includes("/moments")) return [
    "Which moments are most relevant to me?",
    "Suggest tables for upcoming events",
    "What is happening in my focus areas?",
    "Help me prepare for an event",
  ];
  if (location.includes("/messages")) return [
    "Help me draft a message",
    "How should I introduce myself?",
    "Suggest a professional tone for this",
    "What should I include?",
  ];
  return [
    "Suggest relevant tables for me",
    "Show upcoming health moments",
    "What should I focus on today?",
    "Help me find my next collaboration",
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

export function AssistantPanel({ onClose, onDraft }: AssistantPanelProps) {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "How can I support your work today? I can suggest tables, surface upcoming health moments, help draft messages, summarise discussions, or adjust your preferences.",
      suggestedActions: [
        { type: "NAVIGATE", label: "Browse Tables", url: "/app/tables" },
        { type: "NAVIGATE", label: "View Moments", url: "/app/moments" },
      ],
    },
  ]);
  const [input, setInput] = useState("");

  const { tableId, threadId } = parseContext(location);
  const quickActions = getQuickActions(location);

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
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.assistantText || "I'm here to support your work.",
        summaryContent: data.summaryContent,
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

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">TRYBE Assistant</p>
            <p className="text-xs text-muted-foreground">Human-led. AI-supported.</p>
          </div>
        </div>
        {onClose && (
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-assistant">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4">
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

              {/* Summary block */}
              {msg.summaryContent && (
                <div className="mt-2 border border-border rounded-md bg-background overflow-hidden" data-testid={`block-summary-${i}`}>
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <AlignLeft className="h-3 w-3" />
                      Summary
                    </div>
                    <CopyButton text={msg.summaryContent} />
                  </div>
                  <div className="px-3 py-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {msg.summaryContent}
                  </div>
                </div>
              )}

              {/* Draft block */}
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

              {/* Suggested actions */}
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

      {/* Context-aware quick actions */}
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

      {/* Input */}
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
