import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Table2, MessageSquare, Shield, ChevronRight, Star, TrendingUp, FileText, LayoutList } from "lucide-react";

export default function AdminOverview() {
  const { data: metrics, isLoading } = useQuery<any>({ queryKey: ["/api/admin/metrics"] });
  const { data: inviteRequests } = useQuery<any[]>({ queryKey: ["/api/admin/invite-requests"] });
  const pendingInvites = (inviteRequests || []).filter(r => r.status === "PENDING").length;

  const primaryStats = [
    { label: "Total users", value: metrics?.totalUsers, icon: Users, link: "/admin/users" },
    { label: "Active members", value: metrics?.activeUsers, icon: Users, link: "/admin/users" },
    { label: "Pending approval", value: metrics?.pendingApproval, icon: Users, link: "/admin/users" },
    { label: "Tables", value: metrics?.totalTables, icon: Table2, link: "/admin/tables" },
    { label: "Feedback items", value: metrics?.totalFeedback, icon: Star, link: "/admin/feedback" },
    { label: "Open moderation", value: metrics?.openModerationItems, icon: Shield, link: "/admin/moderation" },
  ];

  const participationStats = [
    { label: "Activation rate", value: metrics?.activationRate != null ? `${metrics.activationRate}%` : "—", icon: TrendingUp, note: "registered → active" },
    { label: "Threads", value: metrics?.totalThreads, icon: LayoutList, note: `avg ${metrics?.avgThreadsPerTable ?? 0} per table` },
    { label: "Posts", value: metrics?.totalPosts, icon: FileText, note: `avg ${metrics?.avgPostsPerThread ?? 0} per thread` },
    { label: "Table memberships", value: metrics?.totalMemberships, icon: Users, note: "across all tables" },
  ];

  const actions = [
    { label: "Invite requests", value: pendingInvites, suffix: "pending", link: "/admin/invites", icon: MessageSquare },
    { label: "Moderation queue", value: metrics?.openModerationItems, suffix: "open", link: "/admin/moderation", icon: Shield },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Admin Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">TRYBE Alpha — Platform management</p>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Platform metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {primaryStats.map(stat => (
            <Link key={stat.label} href={stat.link}>
              <div className="bg-card border border-card-border rounded-xl p-4 hover-elevate" data-testid={`stat-${stat.label}`}>
                <stat.icon className="h-4 w-4 text-muted-foreground mb-2" />
                {isLoading ? <Skeleton className="h-7 w-10 mb-1" /> : <p className="text-2xl font-semibold text-foreground">{stat.value ?? 0}</p>}
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Participation</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {participationStats.map(stat => (
            <div key={stat.label} className="bg-card border border-card-border rounded-xl p-4" data-testid={`stat-${stat.label}`}>
              <stat.icon className="h-4 w-4 text-muted-foreground mb-2" />
              {isLoading ? <Skeleton className="h-7 w-10 mb-1" /> : <p className="text-2xl font-semibold text-foreground">{stat.value ?? 0}</p>}
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              {stat.note && <p className="text-xs text-muted-foreground/70 mt-0.5">{stat.note}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Actions required</h2>
        <div className="space-y-2">
          {actions.map(action => (
            <Link key={action.label} href={action.link}>
              <div className="flex items-center justify-between bg-card border border-card-border rounded-xl px-4 py-3 hover-elevate" data-testid={`action-${action.label}`}>
                <div className="flex items-center gap-3">
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{action.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  {(action.value || 0) > 0 && (
                    <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-sm">{action.value} {action.suffix}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
