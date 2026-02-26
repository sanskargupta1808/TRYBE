import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { AssistantPanel } from "@/components/AssistantPanel";
import { useState } from "react";
import { Bot } from "lucide-react";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import RequestInvite from "@/pages/RequestInvite";
import PendingApproval from "@/pages/PendingApproval";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Onboarding from "@/pages/Onboarding";

import Welcome from "@/pages/Welcome";
import Dashboard from "@/pages/Dashboard";
import Invites from "@/pages/Invites";
import Tables from "@/pages/Tables";
import TableDetail from "@/pages/TableDetail";
import ThreadDetail from "@/pages/ThreadDetail";
import RequestTable from "@/pages/RequestTable";
import Moments from "@/pages/Moments";
import Messages from "@/pages/Messages";
import MessageDetail from "@/pages/MessageDetail";
import Feedback from "@/pages/Feedback";
import Settings from "@/pages/Settings";

import AdminOverview from "@/pages/admin/AdminOverview";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminInvites from "@/pages/admin/AdminInvites";
import AdminInviteRequests from "@/pages/admin/AdminInviteRequests";
import AdminTables from "@/pages/admin/AdminTables";
import AdminModeration from "@/pages/admin/AdminModeration";
import AdminCalendar from "@/pages/admin/AdminCalendar";
import AdminFeedback from "@/pages/admin/AdminFeedback";
import AdminAuditLog from "@/pages/admin/AdminAuditLog";
import AdminAppeals from "@/pages/admin/AdminAppeals";

import Privacy from "@/pages/policy/Privacy";
import Terms from "@/pages/policy/Terms";
import CodeOfConduct from "@/pages/policy/CodeOfConduct";
import AITransparency from "@/pages/policy/AITransparency";

import Suspended from "@/pages/Suspended";
import NotFound from "@/pages/not-found";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto relative">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/60 backdrop-blur-md px-4 py-2">
            <SidebarTrigger />
            <div className="flex-1" />
            <button
              onClick={() => setAssistantOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1.5 rounded-md border border-border hover-elevate"
              data-testid="button-open-assistant"
            >
              <Bot className="h-3.5 w-3.5" />
              Ask TRYBE Assistant
            </button>
          </div>
          <div className="relative">
            {children}
          </div>
        </main>
        {assistantOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={() => setAssistantOpen(false)} />
            <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md shadow-2xl bg-background/90 backdrop-blur-xl border-l border-border animate-slide-in-right rounded-l-[2.5rem] overflow-hidden">
              <AssistantPanel onClose={() => setAssistantOpen(false)} />
            </div>
          </>
        )}
      </div>
    </SidebarProvider>
  );
}

function RequireAuth({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <Redirect to="/login" />;
  if (user.status === "PENDING_APPROVAL") return <Redirect to="/pending-approval" />;
  if (user.status === "SUSPENDED") return <Redirect to="/suspended" />;
  if (adminOnly && user.role !== "ADMIN" && user.role !== "MODERATOR") return <Redirect to="/app" />;

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/request-invite" component={RequestInvite} />
      <Route path="/pending-approval" component={PendingApproval} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/suspended" component={Suspended} />

      {/* Policy */}
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/code-of-conduct" component={CodeOfConduct} />
      <Route path="/ai-transparency" component={AITransparency} />

      {/* Onboarding (authenticated but before full app access) */}
      <Route path="/app/onboarding">
        <RequireAuth>
          <Onboarding />
        </RequireAuth>
      </Route>

      {/* Welcome page for auto-approved members */}
      <Route path="/app/welcome">
        <RequireAuth>
          <Welcome />
        </RequireAuth>
      </Route>

      {/* App routes */}
      <Route path="/app">
        <RequireAuth>
          <AppLayout><Dashboard /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/app/invites">
        <RequireAuth>
          <AppLayout><Invites /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/app/tables/request">
        <RequireAuth>
          <AppLayout><RequestTable /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/app/tables/:tableId/threads/:threadId">
        {(params) => (
          <RequireAuth>
            <AppLayout><ThreadDetail /></AppLayout>
          </RequireAuth>
        )}
      </Route>

      <Route path="/app/tables/:id">
        {(params) => (
          <RequireAuth>
            <AppLayout><TableDetail /></AppLayout>
          </RequireAuth>
        )}
      </Route>

      <Route path="/app/tables">
        <RequireAuth>
          <AppLayout><Tables /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/app/moments">
        <RequireAuth>
          <AppLayout><Moments /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/app/messages/:id">
        {(params) => (
          <RequireAuth>
            <AppLayout><MessageDetail /></AppLayout>
          </RequireAuth>
        )}
      </Route>

      <Route path="/app/messages">
        <RequireAuth>
          <AppLayout><Messages /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/app/feedback">
        <RequireAuth>
          <AppLayout><Feedback /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/app/settings">
        <RequireAuth>
          <AppLayout><Settings /></AppLayout>
        </RequireAuth>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <RequireAuth adminOnly>
          <AppLayout><AdminOverview /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/admin/users">
        <RequireAuth adminOnly>
          <AppLayout><AdminUsers /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/admin/invites">
        <RequireAuth adminOnly>
          <AppLayout><AdminInvites /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/admin/invite-requests">
        <RequireAuth adminOnly>
          <AppLayout><AdminInviteRequests /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/admin/tables">
        <RequireAuth adminOnly>
          <AppLayout><AdminTables /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/admin/moderation">
        <RequireAuth adminOnly>
          <AppLayout><AdminModeration /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/admin/calendar">
        <RequireAuth adminOnly>
          <AppLayout><AdminCalendar /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/admin/feedback">
        <RequireAuth adminOnly>
          <AppLayout><AdminFeedback /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/admin/appeals">
        <RequireAuth adminOnly>
          <AppLayout><AdminAppeals /></AppLayout>
        </RequireAuth>
      </Route>

      <Route path="/admin/audit-log">
        <RequireAuth adminOnly>
          <AppLayout><AdminAuditLog /></AppLayout>
        </RequireAuth>
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
