import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, Loader2, Star } from "lucide-react";

const CATEGORIES = [
  { value: "FEATURE", label: "Feature request" },
  { value: "UX", label: "User experience" },
  { value: "SAFETY", label: "Safety concern" },
  { value: "ASSISTANT", label: "TRYBE Assistant" },
  { value: "BUG", label: "Bug report" },
];

export default function Feedback() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [form, setForm] = useState({ category: "", message: "", contextType: "GENERAL" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/feedback", { ...form, rating: rating || undefined });
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 max-w-xl mx-auto flex flex-col items-center text-center pt-16">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-3">Thank you for your feedback</h2>
        <p className="text-muted-foreground text-sm mb-6">Your input helps us improve TRYBE. All feedback flows directly to the team.</p>
        <Button variant="outline" onClick={() => setSubmitted(false)}>Submit more feedback</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Help shape TRYBE</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Alpha is a co-creation phase. Your feedback is taken seriously and reviewed directly by the team.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label className="mb-1.5">Category</Label>
          <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="Select a category..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5">Overall rating (optional)</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button type="button" key={n} onClick={() => setRating(n === rating ? 0 : n)}
                className={`w-9 h-9 rounded-md border text-sm font-medium hover-elevate ${rating >= n ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                data-testid={`rating-${n}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="message" className="mb-1.5">Your feedback</Label>
          <Textarea
            id="message"
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            rows={5}
            placeholder="Share your thoughts, suggestions, or concerns..."
            required
            data-testid="input-feedback-message"
          />
        </div>

        <Button type="submit" disabled={loading || !form.category || !form.message} className="w-full" data-testid="button-submit-feedback">
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Submit feedback
        </Button>
      </form>
    </div>
  );
}
