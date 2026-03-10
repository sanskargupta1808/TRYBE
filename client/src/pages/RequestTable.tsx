import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, CheckCircle, Loader2, Sparkles, Plus, X, Globe, Lock } from "lucide-react";

const COMMON_TAGS = ["rare-disease", "cancer", "diabetes", "mental-health", "HIV/AIDS", "TB", "AMR", "policy", "research", "advocacy", "Global", "Europe", "Africa", "Asia"];

export default function RequestTable() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createdTable, setCreatedTable] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", purpose: "", tags: [] as string[], requiresApprovalToJoin: false });
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");

  const toggleTag = (tag: string) =>
    setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));

  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (!tag) return;
    if (form.tags.includes(tag)) {
      toast({ title: "Tag already added", variant: "destructive" });
      return;
    }
    if (form.tags.length >= 10) {
      toast({ title: "Maximum 10 tags allowed", variant: "destructive" });
      return;
    }
    setForm(f => ({ ...f, tags: [...f.tags, tag] }));
    setCustomTagInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/tables", form);
      const table = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/tables"] });
      setCreatedTable(table);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateProposal = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/ai/generate-table", { prompt: aiPrompt.trim() });
      const data = await res.json();
      const tags = Array.isArray(data.tags) ? data.tags.slice(0, 10) : [];
      setForm(f => ({
        ...f,
        title: data.title || "",
        purpose: (data.purpose || "").slice(0, 240),
        tags,
      }));
      toast({ title: "Proposal drafted", description: "Review and edit the details before creating." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (createdTable) {
    return (
      <div className="p-6 max-w-xl mx-auto flex flex-col items-center text-center pt-20 animate-fade-in-up">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-3" data-testid="text-table-created">Table created</h2>
        <p className="text-muted-foreground mb-6">Your table "{createdTable.title}" is live. You've been assigned as the host. Tables inactive for 14 days are automatically removed, so keep the conversation going.</p>
        <div className="flex gap-3">
          <Button onClick={() => navigate(`/app/tables/${createdTable.id}`)} data-testid="button-open-new-table">Open table</Button>
          <Button variant="outline" onClick={() => navigate("/app/tables")} data-testid="button-back-to-tables">Back to tables</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/app/tables" className="flex items-center gap-1 text-muted-foreground text-sm mb-6 hover-elevate animate-fade-in">
        <ArrowLeft className="h-4 w-4" />Back to tables
      </Link>

      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-semibold mb-2 heading-rule" data-testid="heading-create-table">Create a new table</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Start a collaboration space for your topic. You'll be the host. Tables inactive for 14 days are automatically removed.
        </p>
      </div>

      <div className="mb-6 bg-primary/5 border border-primary/20 rounded-md p-4">
        <p className="text-sm font-medium mb-1">Draft with AI</p>
        <p className="text-xs text-muted-foreground mb-3">Describe the table you have in mind and we'll draft a proposal for you to review and edit.</p>
        <div className="flex gap-2">
          <Input
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="e.g. A table for WHO policy advisors focused on antimicrobial resistance..."
            className="flex-1 text-sm"
            onKeyDown={e => { if (e.key === "Enter") generateProposal(); }}
            data-testid="input-ai-table-prompt"
          />
          <Button size="sm" onClick={generateProposal} disabled={!aiPrompt.trim() || generating} data-testid="button-generate-table">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            {generating ? "Drafting..." : "Draft"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="title" className="mb-1.5">Table title</Label>
          <Input id="title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required data-testid="input-table-title" />
        </div>
        <div>
          <Label htmlFor="purpose" className="mb-1.5">Purpose statement <span className="text-muted-foreground font-normal">(max 240 chars)</span></Label>
          <Textarea id="purpose" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value.slice(0, 240) }))} rows={3} required data-testid="input-table-purpose" />
          <p className="text-xs text-muted-foreground mt-1">{form.purpose.length}/240</p>
        </div>
        <div>
          <Label className="mb-1.5">Scope tags</Label>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMON_TAGS.map(tag => (
              <button type="button" key={tag} onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-md border chip-press ${form.tags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                data-testid={`tag-${tag}`}>
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <Input
              value={customTagInput}
              onChange={e => setCustomTagInput(e.target.value)}
              placeholder="Add a custom tag..."
              className="flex-1 text-sm"
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
              data-testid="input-custom-tag"
            />
            <Button type="button" size="sm" variant="outline" onClick={addCustomTag} disabled={!customTagInput.trim()} data-testid="button-add-custom-tag">
              <Plus className="h-3.5 w-3.5 mr-1" />Add
            </Button>
          </div>
          {form.tags.filter(t => !COMMON_TAGS.includes(t)).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {form.tags.filter(t => !COMMON_TAGS.includes(t)).map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border bg-primary text-primary-foreground border-primary">
                  {tag}
                  <button type="button" onClick={() => toggleTag(tag)} className="hover:opacity-70" data-testid={`remove-tag-${tag}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1.5">{form.tags.length}/10 tags selected</p>
        </div>
        <div>
          <Label className="mb-2">Table visibility</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, requiresApprovalToJoin: false }))}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors text-left ${!form.requiresApprovalToJoin ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
              data-testid="toggle-public"
            >
              <Globe className={`h-4 w-4 mt-0.5 flex-shrink-0 ${!form.requiresApprovalToJoin ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium">Public</p>
                <p className="text-xs text-muted-foreground mt-0.5">Anyone can join instantly</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, requiresApprovalToJoin: true }))}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors text-left ${form.requiresApprovalToJoin ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
              data-testid="toggle-private"
            >
              <Lock className={`h-4 w-4 mt-0.5 flex-shrink-0 ${form.requiresApprovalToJoin ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium">Private</p>
                <p className="text-xs text-muted-foreground mt-0.5">You approve who joins</p>
              </div>
            </button>
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full" data-testid="button-create-table">
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create table
        </Button>
      </form>
    </div>
  );
}
