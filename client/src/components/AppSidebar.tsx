import { Link, useLocation } from "wouter";
import { Home, Table2, Calendar, MessageSquare, Star, Settings, MessageCircle, Shield, Users, BarChart3, ClipboardList, CheckSquare } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const appNavItems = [
  { title: "Dashboard", url: "/app", icon: Home },
  { title: "Spaces", url: "/app/tables", icon: Table2 },
  { title: "Milestones", url: "/app/moments", icon: Calendar },
  { title: "Messages", url: "/app/messages", icon: MessageSquare },
  { title: "Feedback", url: "/app/feedback", icon: Star },
  { title: "Settings", url: "/app/settings", icon: Settings },
];

const adminNavItems = [
  { title: "Overview", url: "/admin", icon: BarChart3 },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Invitations", url: "/admin/invites", icon: MessageCircle },
  { title: "Invite Requests", url: "/admin/invite-requests", icon: ClipboardList },
  { title: "Tables", url: "/admin/tables", icon: Table2 },
  { title: "Table Requests", url: "/admin/table-requests", icon: ClipboardList },
  { title: "Moderation", url: "/admin/moderation", icon: Shield },
  { title: "Calendar", url: "/admin/calendar", icon: Calendar },
  { title: "Feedback", url: "/admin/feedback", icon: CheckSquare },
  { title: "Audit Log", url: "/admin/audit-log", icon: BarChart3 },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <img src="/trybe-logo.png" alt="TRYBE" className="h-[84px] w-auto" />
          <p className="text-xs text-muted-foreground">Alpha</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {appNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url || (item.url !== "/app" && location.startsWith(item.url))}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1">
              Admin
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">Admin</Badge>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url || location.startsWith(item.url)}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-semibold">{user?.name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.organisation || user?.email}</p>
          </div>
        </div>
        <button onClick={logout} className="mt-3 text-xs text-muted-foreground hover-elevate w-full text-left py-1">
          Sign out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
