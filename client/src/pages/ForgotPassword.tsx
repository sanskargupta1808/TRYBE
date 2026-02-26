import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, ArrowLeft, Loader2 } from "lucide-react";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: email.trim() });
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background auth-dots flex items-center justify-center px-6 relative overflow-hidden">
        <div className="auth-glow absolute inset-0 pointer-events-none" />
        <div className="max-w-sm w-full text-center relative z-10 animate-fade-in-up">
          <div className="border border-border rounded-xl bg-card/60 p-8 shadow-md">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">Check your email</h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">If an account exists for <strong>{email}</strong>, we've sent a password reset link. Please check your inbox.</p>
            <Link href="/login"><Button variant="outline" data-testid="button-back-to-login">Back to sign in</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background auth-dots flex items-center justify-center px-6 relative overflow-hidden">
      <div className="auth-glow absolute inset-0 pointer-events-none" />
      <div className="w-full max-w-sm relative z-10 animate-fade-in-up">
        <Link href="/login" className="flex items-center gap-2 text-muted-foreground text-sm mb-8 hover-elevate">
          <ArrowLeft className="h-4 w-4" />Back to sign in
        </Link>
        <div className="text-center mb-8">
          <img src="/trybe-logo.png" alt="TRYBE" className="h-[96px] w-auto mx-auto mb-4 animate-fade-in" />
          <h1 className="text-2xl font-semibold mb-2 stagger-1 animate-fade-in-up">Reset your password</h1>
          <p className="text-muted-foreground text-sm">Enter your email and we'll send you a reset link.</p>
        </div>
        <div className="border border-border rounded-xl bg-card/60 p-6 shadow-md stagger-2 animate-fade-in-up">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="mb-1.5">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus data-testid="input-email" />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-send-reset">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send reset link
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
