import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  useEffect(() => {
    if (pendingRedirect && user) {
      navigate(pendingRedirect);
      setPendingRedirect(null);
    }
  }, [user, pendingRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", form);
      const data = await res.json();

      if (data.user?.status === "PENDING_APPROVAL") {
        await refetch();
        navigate("/pending-approval");
        return;
      }

      const dest =
        data.user?.role === "ADMIN" || data.user?.role === "MODERATOR" || data.profile?.onboardingComplete
          ? "/app"
          : "/app/onboarding";

      await refetch();
      setPendingRedirect(dest);
    } catch (err: any) {
      toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background auth-dots flex items-center justify-center px-6 relative overflow-hidden">
      <div className="auth-glow absolute inset-0 pointer-events-none" />
      <div className="w-full max-w-sm relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <img src="/trybe-logo.png" alt="TRYBE" className="h-[96px] w-auto mx-auto mb-4 animate-fade-in" />
          <h1 className="text-2xl font-semibold stagger-1 animate-fade-in-up">Sign in</h1>
        </div>

        <div className="border border-border rounded-xl bg-card/60 p-6 shadow-md stagger-2 animate-fade-in-up">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="mb-1.5">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required autoFocus data-testid="input-email" />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover-elevate">Forgot password?</Link>
              </div>
              <PasswordInput id="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required data-testid="input-password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full" data-testid="button-signin">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link href="/request-invite" className="text-foreground hover-elevate">Request an invitation</Link>
        </p>

        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            By signing in you agree to TRYBE's{" "}
            <Link href="/code-of-conduct" className="underline">Code of Conduct</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
