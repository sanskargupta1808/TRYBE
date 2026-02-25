import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle2, KeyRound } from "lucide-react";

export default function Register() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    inviteToken: "",
    organisation: "",
    roleTitle: "",
  });

  const tokenFromUrl = new URLSearchParams(search).get("invite") || "";
  const isPreFilled = !!tokenFromUrl;

  useEffect(() => {
    if (tokenFromUrl) {
      setForm(f => ({ ...f, inviteToken: tokenFromUrl }));
    }
  }, [tokenFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast({ title: "Please agree to the Code of Conduct before continuing.", variant: "destructive" });
      return;
    }
    if (!form.inviteToken.trim()) {
      toast({ title: "An invitation code is required to register.", variant: "destructive" });
      return;
    }
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
      await apiRequest("POST", "/api/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        inviteToken: form.inviteToken.trim(),
        organisation: form.organisation,
        roleTitle: form.roleTitle,
      });
      await refetch();
      navigate("/pending-approval");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background auth-dots flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="auth-glow absolute inset-0 pointer-events-none" />
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <img src="/trybe-logo.png" alt="TRYBE" className="h-[96px] w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-semibold">Welcome to TRYBE</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isPreFilled
              ? "Your invitation has been recognised. Complete the form to create your account."
              : "Enter your invitation code to create your account."}
          </p>
        </div>

        <div className="border border-border rounded-md bg-card/60 p-6 shadow-md">
        {isPreFilled && (
          <div className="flex items-center gap-2.5 bg-muted/60 border border-border rounded-md px-3 py-2.5 mb-5" data-testid="status-invite-prefilled">
            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">Invitation recognised</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{tokenFromUrl}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isPreFilled && (
            <div>
              <Label htmlFor="token" className="mb-1.5">Invitation code</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="token"
                  value={form.inviteToken}
                  onChange={e => setForm(f => ({ ...f, inviteToken: e.target.value.trim() }))}
                  placeholder="e.g. ALPHA-TRYBE-002 or your personal code"
                  className="pl-9 font-mono text-sm"
                  required
                  data-testid="input-invite-token"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                You can find this code in your invitation email, or paste the registration link directly.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="name" className="mb-1.5">Full name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              data-testid="input-name"
            />
          </div>

          <div>
            <Label htmlFor="org" className="mb-1.5">Organisation</Label>
            <Input
              id="org"
              value={form.organisation}
              onChange={e => setForm(f => ({ ...f, organisation: e.target.value }))}
              placeholder="Your institution, company or NGO"
              data-testid="input-organisation"
            />
          </div>

          <div>
            <Label htmlFor="role" className="mb-1.5">Role</Label>
            <Input
              id="role"
              value={form.roleTitle}
              onChange={e => setForm(f => ({ ...f, roleTitle: e.target.value }))}
              placeholder="e.g. Public Health Advisor"
              data-testid="input-role"
            />
          </div>

          <div>
            <Label htmlFor="email" className="mb-1.5">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              data-testid="input-email"
            />
            {isPreFilled && (
              <p className="text-xs text-muted-foreground mt-1">
                If your invite was issued to a specific address, use that email here.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="password" className="mb-1.5">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              data-testid="input-password"
            />
            <p className="text-xs text-muted-foreground mt-1">At least 12 characters.</p>
          </div>

          <div>
            <Label htmlFor="confirm" className="mb-1.5">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              required
              data-testid="input-confirm-password"
            />
          </div>

          <div className="flex items-start gap-3 py-1">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={v => setAgreed(!!v)}
              data-testid="checkbox-agree"
            />
            <Label htmlFor="agree" className="text-sm font-normal leading-relaxed cursor-pointer">
              I agree to the{" "}
              <Link href="/code-of-conduct" className="underline text-foreground" target="_blank">Code of Conduct</Link>
              {" "}and{" "}
              <Link href="/ai-transparency" className="underline text-foreground" target="_blank">AI Transparency</Link>
              {" "}policy.
            </Label>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            data-testid="button-create-account"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create account
          </Button>
        </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground hover-elevate">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
