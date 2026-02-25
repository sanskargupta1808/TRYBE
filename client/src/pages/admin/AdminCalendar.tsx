import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Trash2, Sparkles } from "lucide-react";

const emptyForm = { title: "", startDate: "", endDate: "", organiser: "", sourceNote: "", tags: "", regionScope: "" };

export default function AdminCalendar() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [aiDescription, setAiDescription] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/calendar"] });
  const events = data?.events || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/calendar", {
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/calendar"] });
      setCreating(false);
      setForm(emptyForm);
      setAiDescription("");
      toast({ title: "Event added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("DELETE", `/api/admin/calendar/${id}`, {}); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar"] }); toast({ title: "Event removed" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const generateEvent = async () => {
    if (!aiDescription.trim()) return;
    setGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/ai/generate-event", { description: aiDescription.trim() });
      const data = await res.json();
      setForm({
        title: data.title || "",
        startDate: data.startDate || "",
        endDate: data.endDate || "",
        organiser: data.organiser || "",
        sourceNote: data.sourceNote || "",
        tags: Array.isArray(data.tags) ? data.tags.join(", ") : (data.tags || ""),
        regionScope: data.regionScope || "",
      });
      toast({ title: "Event generated", description: "Review the details and save." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Moments / Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage the 2026 health calendar</p>
        </div>
        <Button size="sm" onClick={() => setCreating(v => !v)} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-1" />Add event
        </Button>
      </div>

      {creating && (
        <div className="bg-card border border-card-border rounded-xl p-4 mb-6">
          <h3 className="font-medium mb-4">Add calendar event</h3>

          <div className="mb-4 bg-primary/5 border border-primary/20 rounded-md p-3">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Generate event details with AI</p>
            <div className="flex gap-2">
              <Input
                value={aiDescription}
                onChange={e => setAiDescription(e.target.value)}
                placeholder="Describe the event in plain language, e.g. WHO World Malaria Day conference in Geneva, April 2026..."
                className="flex-1 text-sm"
                onKeyDown={e => { if (e.key === "Enter") generateEvent(); }}
                data-testid="input-ai-event-description"
              />
              <Button size="sm" onClick={generateEvent} disabled={!aiDescription.trim() || generating} data-testid="button-generate-event">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                {generating ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1.5">Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-event-title" /></div>
              <div><Label className="mb-1.5">Organiser</Label><Input value={form.organiser} onChange={e => setForm(f => ({ ...f, organiser: e.target.value }))} data-testid="input-event-organiser" /></div>
              <div><Label className="mb-1.5">Start date *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} data-testid="input-event-start" /></div>
              <div><Label className="mb-1.5">End date</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} data-testid="input-event-end" /></div>
              <div><Label className="mb-1.5">Tags (comma-separated)</Label><Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="cancer, policy..." data-testid="input-event-tags" /></div>
              <div><Label className="mb-1.5">Region scope</Label><Input value={form.regionScope} onChange={e => setForm(f => ({ ...f, regionScope: e.target.value }))} placeholder="Global, Europe..." data-testid="input-event-region" /></div>
            </div>
            <div><Label className="mb-1.5">Source note</Label><Textarea value={form.sourceNote} onChange={e => setForm(f => ({ ...f, sourceNote: e.target.value }))} rows={2} placeholder="Brief description or source information..." data-testid="input-event-note" /></div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.startDate || createMutation.isPending} data-testid="button-save-event">
                {createMutation.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}Save event
              </Button>
              <Button variant="ghost" onClick={() => { setCreating(false); setForm(emptyForm); setAiDescription(""); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-md" />)}</div>
      ) : (
        <div className="space-y-2">
          {events.map((event: any) => (
            <div key={event.id} className="flex items-center justify-between bg-card border border-card-border rounded-xl px-4 py-3" data-testid={`row-event-${event.id}`}>
              <div>
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground">{event.startDate} {event.organiser && `· ${event.organiser}`}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(event.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-event-${event.id}`}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No events yet. Add the first one above.</p>
          )}
        </div>
      )}
    </div>
  );
}
