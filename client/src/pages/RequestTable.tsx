import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

const COMMON_TAGS = ["rare-disease", "cancer", "diabetes", "mental-health", "HIV/AIDS", "TB", "AMR", "policy", "research", "advocacy", "Global", "Europe", "Africa", "Asia"];

export default function RequestTable() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", purpose: "", tags: [] as string[], reason: "" });

  const toggleTag = (tag: string) =>
    setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/table-requests", form);
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 max-w-xl mx-auto flex flex-col items-center text-center pt-20">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-3">Request submitted</h2>
        <p className="text-muted-foreground mb-6">Thanks. We'll review this request shortly. If approved, you'll be invited as the table host.</p>
        <Button variant="outline" onClick={() => navigate("/app/tables")}>Back to tables</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link href="/app/tables" className="flex items-center gap-1 text-muted-foreground text-sm mb-6 hover-elevate">
        <ArrowLeft className="h-4 w-4" />Back to tables
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Request a new table</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tables are intentionally curated during Alpha to protect focus and trust. Tell us what you want to create.
        </p>
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
          <div className="flex flex-wrap gap-2">
            {COMMON_TAGS.map(tag => (
              <button type="button" key={tag} onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-md border ${form.tags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                data-testid={`tag-${tag}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="reason" className="mb-1.5">Why is this needed now?</Label>
          <Textarea id="reason" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} data-testid="input-table-reason" />
        </div>
        <Button type="submit" disabled={loading} className="w-full" data-testid="button-submit-table">
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit request
        </Button>
      </form>
    </div>
  );
}
