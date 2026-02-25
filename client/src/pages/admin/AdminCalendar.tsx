import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Trash2 } from "lucide-react";

export default function AdminCalendar() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", startDate: "", endDate: "", organiser: "", description: "", tags: "", regionScope: "" });

  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/calendar"] });
  const events = data?.events || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/calendar", { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar"] }); setCreating(false); setForm({ title: "", startDate: "", endDate: "", organiser: "", description: "", tags: "", regionScope: "" }); toast({ title: "Event added" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("DELETE", `/api/admin/calendar/${id}`, {}); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar"] }); toast({ title: "Event removed" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

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
        <div className="bg-card border border-card-border rounded-md p-4 mb-6">
          <h3 className="font-medium mb-4">Add calendar event</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1.5">Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} data-testid="input-event-title" /></div>
              <div><Label className="mb-1.5">Organiser</Label><Input value={form.organiser} onChange={e => setForm(f => ({ ...f, organiser: e.target.value }))} data-testid="input-event-organiser" /></div>
              <div><Label className="mb-1.5">Start date *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} data-testid="input-event-start" /></div>
              <div><Label className="mb-1.5">End date</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} data-testid="input-event-end" /></div>
              <div><Label className="mb-1.5">Tags (comma-separated)</Label><Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="cancer, policy..." data-testid="input-event-tags" /></div>
              <div><Label className="mb-1.5">Region scope</Label><Input value={form.regionScope} onChange={e => setForm(f => ({ ...f, regionScope: e.target.value }))} placeholder="Global, Europe..." data-testid="input-event-region" /></div>
            </div>
            <div><Label className="mb-1.5">Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} data-testid="input-event-desc" /></div>
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.startDate || createMutation.isPending} data-testid="button-save-event">
                {createMutation.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}Save event
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-md" />)}</div>
      ) : (
        <div className="space-y-2">
          {events.map((event: any) => (
            <div key={event.id} className="flex items-center justify-between bg-card border border-card-border rounded-md px-4 py-3" data-testid={`row-event-${event.id}`}>
              <div>
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground">{event.startDate} {event.organiser && `· ${event.organiser}`}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(event.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-event-${event.id}`}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
