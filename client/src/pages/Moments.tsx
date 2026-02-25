import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CheckCircle, Star, ThumbsUp } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const SIGNAL_TYPES = [
  { type: "SUPPORT", label: "Support", icon: ThumbsUp },
  { type: "INTERESTED", label: "Interested", icon: Star },
  { type: "ATTENDING", label: "Attending", icon: CheckCircle },
];

export default function Moments() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/calendar"] });

  const signalMutation = useMutation({
    mutationFn: async ({ eventId, signalType }: { eventId: string; signalType: string }) => {
      const res = await apiRequest("POST", `/api/calendar/${eventId}/signal`, { signalType });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/calendar"] }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const events = data?.events || [];
  const signals = data?.signals || [];
  const getSignal = (eventId: string) => signals.find((s: any) => s.eventId === eventId)?.signalType;

  // Group by month
  const grouped: Record<string, any[]> = {};
  events.forEach((event: any) => {
    const month = event.startDate.slice(0, 7);
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(event);
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-foreground heading-rule">Health milestones</h1>
        <p className="text-muted-foreground text-sm mt-2">A curated calendar of awareness days, congresses, and policy windows.</p>
      </div>

      <div className="bg-muted/30 border border-border rounded-xl p-3 mb-6 text-xs text-muted-foreground">
        Your responses are visible only to relevant connections.
      </div>

      {isLoading ? (
        <div className="space-y-6">{[1,2,3].map(i => <div key={i}><Skeleton className="h-5 w-24 mb-3" /><div className="space-y-3">{[1,2].map(j => <Skeleton key={j} className="h-24 rounded-md" />)}</div></div>)}</div>
      ) : events.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-xl p-10 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.08), transparent 70%)' }}>
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-5">No milestones match your focus yet. Update your interests or ask for suggestions.</p>
          <Button onClick={() => {
            const btn = document.querySelector('[data-testid="button-open-assistant"]') as HTMLButtonElement;
            btn?.click();
          }} data-testid="button-ask-assistant-moments">Ask TRYBE Assistant</Button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).sort().map(([month, monthEvents]) => {
            const [year, m] = month.split("-");
            const monthName = `${MONTHS[parseInt(m) - 1]} ${year}`;
            return (
              <section key={month}>
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
                                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                                  ))}
                                  {event.regionScope && <Badge variant="outline" className="text-xs">{event.regionScope}</Badge>}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            {SIGNAL_TYPES.map(({ type, label, icon: Icon }) => (
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
      )}
    </div>
  );
}
