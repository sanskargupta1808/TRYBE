import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Bot, Send, ChevronRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  suggestedActions?: SuggestedAction[];
}

interface AssistantPanelProps {
  onClose?: () => void;
}

const QUICK_ACTIONS = [
  "Suggest relevant tables for me",
  "Show upcoming health moments",
  "Help me draft a message",
  "Summarise my recent activity",
];

export function AssistantPanel({ onClose }: AssistantPanelProps) {
  const [location, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "How can I support your work today? I can suggest tables, surface upcoming health moments, help draft messages, or adjust your preferences.",
      suggestedActions: [
        { type: "NAVIGATE", label: "Browse Tables", url: "/app/tables" },
        { type: "NAVIGATE", label: "View Moments", url: "/app/moments" },
      ],
    },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/assistant", { message, context: { page: location } });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.assistantText || "I'm here to support your work.",
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

  const handleSuggestedAction = (action: SuggestedAction) => {
    if (action.url) navigate(action.url);
    if (action.type === "SUGGEST_JOIN_TABLE" && action.tableId) navigate(`/app/tables/${action.tableId}`);
    if (action.type === "SUGGEST_SUMMARISE_THREAD" && action.threadId) navigate(`/app/threads/${action.threadId}`);
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
                <div className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {msg.content}
                </div>
              </div>
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-2 space-y-1 ml-0">
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

      {/* Quick actions */}
      <div className="px-4 py-2 border-t border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground mb-2">Quick actions</p>
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => handleQuickAction(action)}
              className="text-xs rounded-sm px-2 py-1 bg-muted text-muted-foreground hover-elevate"
              data-testid={`button-quick-${action.slice(0, 10)}`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <p className="text-xs text-muted-foreground mb-2">
          I can suggest actions, but won't do anything without your approval.
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
          <Button size="icon" onClick={handleSend} disabled={sendMessage.isPending || !input.trim()} data-testid="button-assistant-send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
