import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, CheckCircle, Star, ThumbsUp, Plus, MapPin, Link as LinkIcon, X, Users, Trash2 } from "lucide-react";
import { tagColour } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const CALENDAR_SIGNAL_TYPES = [
  { type: "SUPPORT", label: "Support", icon: ThumbsUp },
  { type: "INTERESTED", label: "Interested", icon: Star },
  { type: "ATTENDING", label: "Attending", icon: CheckCircle },
];

const MILESTONE_SIGNAL_TYPES = [
  { type: "INTERESTED", label: "Interested", icon: Star },
  { type: "ATTENDING", label: "Attending", icon: CheckCircle },
];

const PREDEFINED_TAGS = [
  "Immunisation", "Mental health", "Climate & health", "NCD", "Maternal health",
  "HIV/AIDS", "Nutrition", "Health equity", "Digital health", "AMR",
  "Pandemic preparedness", "UHC", "TB", "Malaria", "Research",
  "Policy", "Advocacy", "Conference", "Workshop", "Webinar",
];

export default function Moments() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<"calendar" | "milestones">("calendar");
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-foreground heading-rule">Moments</h1>
        <p className="text-muted-foreground text-sm mt-2">Global health events, milestones, and community gatherings.</p>
      </div>

      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg mb-6 animate-fade-in-up stagger-1" data-testid="tabs-moments">
        <button
          onClick={() => setTab("calendar")}
          className={`flex-1 text-sm font-medium px-4 py-2 rounded-md transition-colors ${tab === "calendar" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          data-testid="tab-calendar"
        >
          WHO Calendar
        </button>
        <button
          onClick={() => setTab("milestones")}
          className={`flex-1 text-sm font-medium px-4 py-2 rounded-md transition-colors ${tab === "milestones" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          data-testid="tab-milestones"
        >
          Milestones
        </button>
      </div>

      {tab === "calendar" ? <CalendarTab /> : <MilestonesTab showCreateForm={showCreateForm} setShowCreateForm={setShowCreateForm} userId={user?.id} />}
    </div>
  );
}

function CalendarTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/calendar"] });

  const signalMutation = useMutation({
    mutationFn: async ({ eventId, signalType }: { eventId: string; signalType: string }) => {
      const res = await apiRequest("POST", `/api/calendar/${eventId}/signal`, { signalType });
      return res.json();
    },
    onSuccess: (data: any, variables) => {
      if (variables.signalType === "ATTENDING" && data && !data.removed) {
        toast({ title: "You're attending!", description: "Check your email for the full event details." });
      }
      qc.invalidateQueries({ queryKey: ["/api/calendar"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const events = data?.events || [];
  const signals = data?.signals || [];
  const getSignal = (eventId: string) => signals.find((s: any) => s.eventId === eventId)?.signalType;

  const grouped: Record<string, any[]> = {};
  events.forEach((event: any) => {
    const month = event.startDate.slice(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(event);
  });

  if (isLoading) {
    return <div className="space-y-6">{[1, 2, 3].map(i => <div key={i}><Skeleton className="h-5 w-24 mb-3" /><div className="space-y-3">{[1, 2].map(j => <Skeleton key={j} className="h-24 rounded-md" />)}</div></div>)}</div>;
  }

  if (events.length === 0) {
    return (
      <div className="bg-muted/30 border border-border rounded-xl p-10 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08), transparent 70%)' }}>
          <Calendar className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No upcoming WHO calendar events.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-muted/30 border border-border rounded-xl p-3 text-xs text-muted-foreground animate-fade-in-up">
        Official WHO Global Health Days and awareness campaigns. Your responses are visible only to relevant connections.
      </div>
      {Object.entries(grouped).sort().map(([month, monthEvents], idx) => {
        const [year, m] = month.split("-");
        const monthName = `${MONTHS[parseInt(m) - 1]} ${year}`;
        return (
          <section key={month} className={`animate-fade-in-up stagger-${Math.min(idx + 2, 6)}`}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">{monthName}</h2>
            <div className="space-y-3">
              {monthEvents.map((event: any) => {
                const currentSignal = getSignal(event.id);
                return (
                  <div key={event.id} className="bg-card border border-card-border rounded-xl p-4 pl-5 hover-elevate moment-accent-bar" data-testid={`card-event-${event.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary/10 rounded-md px-2 py-1 text-center min-w-[48px] flex-shrink-0">
                            <p className="text-xs font-semibold text-primary">{formatDate(event.startDate).slice(0, 6)}</p>
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground text-sm">{event.title}</h3>
                            {event.organiser && <p className="text-xs text-muted-foreground mt-0.5">{event.organiser}</p>}
                            {event.endDate && <p className="text-xs text-muted-foreground">Until {formatDate(event.endDate)}</p>}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(event.tags || []).slice(0, 4).map((tag: string) => (
                                <Badge key={tag} variant="secondary" className={`text-xs border ${tagColour(tag)}`}>{tag}</Badge>
                              ))}
                              {event.regionScope && <Badge variant="outline" className="text-xs">{event.regionScope}</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {CALENDAR_SIGNAL_TYPES.map(({ type, label, icon: Icon }) => (
                          <button
                            key={type}
                            onClick={() => signalMutation.mutate({ eventId: event.id, signalType: type })}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors chip-press ${currentSignal === type ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                            data-testid={`button-signal-${type}-${event.id}`}
                          >
                            <Icon className="h-3 w-3" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MilestonesTab({ showCreateForm, setShowCreateForm, userId }: { showCreateForm: boolean; setShowCreateForm: (v: boolean) => void; userId?: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/milestones"] });

  const signalMutation = useMutation({
    mutationFn: async ({ eventId, signalType }: { eventId: string; signalType: string }) => {
      const res = await apiRequest("POST", `/api/milestones/${eventId}/signal`, { signalType });
      return res.json();
    },
    onSuccess: (data: any, variables) => {
      if (variables.signalType === "ATTENDING" && data && !data.removed) {
        toast({ title: "You're attending!", description: "Check your email for the full event details." });
      }
      qc.invalidateQueries({ queryKey: ["/api/milestones"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/milestones/${id}`);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/milestones"] }); toast({ title: "Event deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const events = data?.events || [];
  const signals = data?.signals || [];
  const getSignal = (eventId: string) => signals.find((s: any) => s.eventId === eventId)?.signalType;

  const grouped: Record<string, any[]> = {};
  events.forEach((event: any) => {
    const month = event.eventDate.slice(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(event);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <p className="text-xs text-muted-foreground">Community-created events, conferences, and milestones.</p>
        <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-create-milestone">
          {showCreateForm ? <><X className="h-3.5 w-3.5 mr-1.5" />Cancel</> : <><Plus className="h-3.5 w-3.5 mr-1.5" />Create event</>}
        </Button>
      </div>

      {showCreateForm && <CreateMilestoneForm onClose={() => setShowCreateForm(false)} />}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-md" />)}</div>
      ) : events.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-xl p-10 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08), transparent 70%)' }}>
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground mb-1">No milestones yet</p>
          <p className="text-sm text-muted-foreground mb-5">Be the first to share an event with the community.</p>
          {!showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)} data-testid="button-create-first-milestone">
              <Plus className="h-4 w-4 mr-1.5" />Create event
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).sort().map(([month, monthEvents], idx) => {
            const [year, m] = month.split("-");
            const monthName = `${MONTHS[parseInt(m) - 1]} ${year}`;
            return (
              <section key={month} className={`animate-fade-in-up stagger-${Math.min(idx + 2, 6)}`}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">{monthName}</h2>
                <div className="space-y-3">
                  {monthEvents.map((event: any) => {
                    const currentSignal = getSignal(event.id);
                    const isCreator = event.createdByUserId === userId;
                    return (
                      <div key={event.id} className="bg-card border border-card-border rounded-xl p-4 pl-5 hover-elevate moment-accent-bar" data-testid={`card-milestone-${event.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <div className="bg-primary/10 rounded-md px-2 py-1 text-center min-w-[48px] flex-shrink-0">
                                <p className="text-xs font-semibold text-primary">{formatDate(event.eventDate).slice(0, 6)}</p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-foreground text-sm">{event.title}</h3>
                                {event.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>}
                                {event.endDate && <p className="text-xs text-muted-foreground mt-0.5">Until {formatDate(event.endDate)}</p>}

                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {event.location && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <MapPin className="h-3 w-3" />{event.location}
                                    </span>
                                  )}
                                  {event.virtualLink && (
                                    <a href={event.virtualLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline" data-testid={`link-virtual-${event.id}`}>
                                      <LinkIcon className="h-3 w-3" />Join online
                                    </a>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-1 mt-2">
                                  {(event.tags || []).slice(0, 6).map((tag: string) => (
                                    <Badge key={tag} variant="secondary" className={`text-xs border ${tagColour(tag)}`}>{tag}</Badge>
                                  ))}
                                </div>

                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  {event.creator && <span>By {event.creator.name}{event.creator.organisation && ` · ${event.creator.organisation}`}</span>}
                                  {event.counts && (event.counts.interested > 0 || event.counts.attending > 0) && (
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {event.counts.interested > 0 && `${event.counts.interested} interested`}
                                      {event.counts.interested > 0 && event.counts.attending > 0 && " · "}
                                      {event.counts.attending > 0 && `${event.counts.attending} attending`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="flex gap-1.5">
                              {MILESTONE_SIGNAL_TYPES.map(({ type, label, icon: Icon }) => (
                                <button
                                  key={type}
                                  onClick={() => signalMutation.mutate({ eventId: event.id, signalType: type })}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors chip-press ${currentSignal === type ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover-elevate"}`}
                                  data-testid={`button-milestone-signal-${type}-${event.id}`}
                                >
                                  <Icon className="h-3 w-3" />
                                  {label}
                                </button>
                              ))}
                            </div>
                            {isCreator && (
                              <button
                                onClick={() => { if (window.confirm("Delete this event?")) deleteMutation.mutate(event.id); }}
                                className="text-xs text-muted-foreground hover:text-destructive transition-colors p-1"
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-milestone-${event.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateMilestoneForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [virtualLink, setVirtualLink] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/milestones", {
        title: title.trim(),
        description: description.trim() || null,
        eventDate,
        endDate: endDate || null,
        location: location.trim() || null,
        virtualLink: virtualLink.trim() || null,
        tags,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/milestones"] });
      toast({ title: "Event created" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length < 10 ? [...prev, tag] : prev);
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags(prev => [...prev, trimmed]);
      setCustomTag("");
    }
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 animate-fade-in-up" data-testid="form-create-milestone">
      <h3 className="font-medium text-foreground mb-4">Create a milestone</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Global Health Summit 2026" data-testid="input-milestone-title" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this event about?" rows={3} className="resize-none" data-testid="input-milestone-description" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Start date *</label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} data-testid="input-milestone-date" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">End date</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-milestone-end-date" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" data-testid="input-milestone-location" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Virtual link</label>
            <Input value={virtualLink} onChange={e => setVirtualLink(e.target.value)} placeholder="https://zoom.us/..." data-testid="input-milestone-link" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tags ({tags.length}/10)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PREDEFINED_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors chip-press ${tags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground hover:border-primary/40"}`}
                data-testid={`tag-option-${tag}`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={customTag}
              onChange={e => setCustomTag(e.target.value)}
              placeholder="Add custom tag..."
              className="text-sm"
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
              data-testid="input-milestone-custom-tag"
            />
            <Button size="sm" variant="outline" onClick={addCustomTag} disabled={!customTag.trim() || tags.length >= 10} data-testid="button-add-custom-tag">Add</Button>
          </div>
          {tags.filter(t => !PREDEFINED_TAGS.includes(t)).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.filter(t => !PREDEFINED_TAGS.includes(t)).map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleTag(tag)}>
                  {tag} <X className="h-2.5 w-2.5 ml-1" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || !eventDate || createMutation.isPending}
            data-testid="button-submit-milestone"
          >
            {createMutation.isPending ? "Creating..." : "Create event"}
          </Button>
        </div>
      </div>
    </div>
  );
}
