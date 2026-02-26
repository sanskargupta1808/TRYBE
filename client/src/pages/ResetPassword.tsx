import { useState } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, Loader2, ShieldAlert } from "lucide-react";

export default function ResetPassword() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const token = new URLSearchParams(search).get("token") || "";

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ password: "", confirmPassword: "" });

  if (!token) {
    return (
      <div className="min-h-screen bg-background auth-dots flex items-center justify-center px-6 relative overflow-hidden">
        <div className="auth-glow absolute inset-0 pointer-events-none" />
        <div className="max-w-sm w-full text-center relative z-10 animate-fade-in-up">
          <div className="border border-border rounded-xl bg-card/60 p-8 shadow-md">
            <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">Invalid reset link</h1>
            <p className="text-muted-foreground mb-6 leading-relaxed">This password reset link is missing or invalid. Please request a new one.</p>
            <Link href="/forgot-password"><Button data-testid="button-request-new-reset">Request a new reset link</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast({ title: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (form.password.length < 12) {
      toast({ title: "Password must be at least 12 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password: form.password });
      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background auth-dots flex items-center justify-center px-6 relative overflow-hidden">
        <div className="auth-glow absolute inset-0 pointer-events-none" />
        <div className="max-w-sm w-full text-center relative z-10 animate-fade-in-up">
          <div className="border border-border rounded-xl bg-card/60 p-8 shadow-md">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">Password updated</h1>
            <p className="text-muted-foreground mb-6 leading-relaxed">Your password has been reset successfully. You can now sign in with your new password.</p>
            <Link href="/login"><Button data-testid="button-go-to-login">Sign in</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background auth-dots flex items-center justify-center px-6 relative overflow-hidden">
      <div className="auth-glow absolute inset-0 pointer-events-none" />
      <div className="w-full max-w-sm relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <img src="/trybe-logo.png" alt="TRYBE" className="h-[96px] w-auto mx-auto mb-4 animate-fade-in" />
          <h1 className="text-2xl font-semibold mb-2 stagger-1 animate-fade-in-up">Choose a new password</h1>
          <p className="text-muted-foreground text-sm">Your new password must be at least 12 characters.</p>
        </div>

        <div className="border border-border rounded-xl bg-card/60 p-6 shadow-md stagger-2 animate-fade-in-up">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password" className="mb-1.5">New password</Label>
              <PasswordInput
                id="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                autoFocus
                data-testid="input-password"
              />
              <p className="text-xs text-muted-foreground mt-1">At least 12 characters.</p>
            </div>
            <div>
              <Label htmlFor="confirm" className="mb-1.5">Confirm new password</Label>
              <PasswordInput
                id="confirm"
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                required
                data-testid="input-confirm-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-reset-password">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset password
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Remember your password?{" "}
          <Link href="/login" className="text-foreground hover-elevate">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
