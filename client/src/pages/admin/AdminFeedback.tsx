import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  FEATURE: "Feature request",
  UX: "User experience",
  SAFETY: "Safety concern",
  ASSISTANT: "TRYBE Assistant",
  BUG: "Bug report",
};

export default function AdminFeedback() {
  const { data: items = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/feedback"] });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Member Feedback</h1>
        <p className="text-muted-foreground text-sm mt-1">{items.length} submission{items.length !== 1 ? "s" : ""} total</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-md" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">No feedback submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="bg-card border border-card-border rounded-xl p-4" data-testid={`card-feedback-${item.id}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[item.category] || item.category}</Badge>
                  {item.rating && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < item.rating ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("en-GB")}</p>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{item.message}</p>
              {item.submittedByName && <p className="text-xs text-muted-foreground mt-2">From: {item.submittedByName}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
