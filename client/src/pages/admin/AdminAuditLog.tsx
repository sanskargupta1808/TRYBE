import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  USER_APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  USER_REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  USER_SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  TABLE_CREATED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  INVITE_CREATED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  MODERATION_ACTION: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function AdminAuditLog() {
  const { data: logs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/audit-log"] });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">Complete admin activity history</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
      ) : logs.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-md p-8 text-center">
          <ScrollText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No audit log entries yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log: any) => (
            <div key={log.id} className="flex items-center justify-between bg-card border border-card-border rounded-md px-4 py-2.5" data-testid={`row-audit-${log.id}`}>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${ACTION_COLORS[log.action] || "bg-muted text-muted-foreground"}`}>{log.action?.replace(/_/g, " ")}</span>
                <p className="text-sm text-foreground">{log.description || log.metadata?.summary || "—"}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
