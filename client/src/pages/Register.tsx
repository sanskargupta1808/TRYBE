import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle } from "lucide-react";

export default function Register() {
  const [, navigate] = useLocation();
  const { refetch } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", inviteToken: "", organisation: "", roleTitle: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { toast({ title: "Please agree to the Code of Conduct", variant: "destructive" }); return; }
    if (form.password !== form.confirmPassword) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    if (form.password.length < 12) { toast({ title: "Password must be at least 12 characters", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", form);
      await refetch();
      navigate("/pending-approval");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold">T</span>
          </div>
          <h1 className="text-2xl font-semibold">Welcome to TRYBE</h1>
          <p className="text-muted-foreground text-sm mt-1">Enter your invitation code to begin.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="token" className="mb-1.5">Invite Code</Label>
            <Input id="token" value={form.inviteToken} onChange={e => setForm(f => ({ ...f, inviteToken: e.target.value.toUpperCase() }))} placeholder="ALPHA-TRYBE-XXX" required data-testid="input-invite-token" />
          </div>
          <div>
            <Label htmlFor="name" className="mb-1.5">Full name</Label>
            <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required data-testid="input-name" />
          </div>
          <div>
            <Label htmlFor="org" className="mb-1.5">Organisation</Label>
            <Input id="org" value={form.organisation} onChange={e => setForm(f => ({ ...f, organisation: e.target.value }))} data-testid="input-organisation" />
          </div>
          <div>
            <Label htmlFor="role" className="mb-1.5">Role</Label>
            <Input id="role" value={form.roleTitle} onChange={e => setForm(f => ({ ...f, roleTitle: e.target.value }))} data-testid="input-role" />
          </div>
          <div>
            <Label htmlFor="email" className="mb-1.5">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required data-testid="input-email" />
          </div>
          <div>
            <Label htmlFor="password" className="mb-1.5">Password</Label>
            <Input id="password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required data-testid="input-password" />
            <p className="text-xs text-muted-foreground mt-1">Password must be at least 12 characters.</p>
          </div>
          <div>
            <Label htmlFor="confirm" className="mb-1.5">Confirm password</Label>
            <Input id="confirm" type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} required data-testid="input-confirm-password" />
          </div>

          <div className="flex items-start gap-3 py-1">
            <Checkbox id="agree" checked={agreed} onCheckedChange={v => setAgreed(!!v)} data-testid="checkbox-agree" />
            <Label htmlFor="agree" className="text-sm font-normal leading-relaxed cursor-pointer">
              I agree to the{" "}
              <Link href="/code-of-conduct" className="underline text-foreground" target="_blank">Code of Conduct</Link>
              {" "}and{" "}
              <Link href="/ai-transparency" className="underline text-foreground" target="_blank">AI Transparency</Link>
              {" "}policy.
            </Label>
          </div>

          <Button type="submit" disabled={loading} className="w-full" data-testid="button-create-account">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground hover-elevate">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
