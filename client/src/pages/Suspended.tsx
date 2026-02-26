import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShieldAlert, Loader2, CheckCircle2, Send } from "lucide-react";

export default function Suspended() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      toast({ title: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    if (message.trim().length < 20) {
      toast({ title: "Please provide a more detailed message (at least 20 characters).", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reactivation-appeal", { email: email.trim(), message: message.trim() });
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Unable to submit appeal", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background auth-dots flex items-center justify-center px-6 relative overflow-hidden">
      <div className="auth-glow absolute inset-0 pointer-events-none" />
      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        {submitted ? (
          <div className="border border-border rounded-xl bg-card/60 p-8 shadow-md text-center">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-3" data-testid="text-appeal-submitted">Appeal submitted</h1>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Your reactivation request has been sent to the TRYBE admin team. If approved, you'll receive an email confirming that your account has been reactivated.
            </p>
            <Link href="/login">
              <Button variant="outline" data-testid="link-back-to-login">Back to sign in</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <img src="/trybe-logo.png" alt="TRYBE" className="h-[96px] w-auto mx-auto mb-4 animate-fade-in" />
              <h1 className="text-2xl font-semibold stagger-1 animate-fade-in-up" data-testid="text-suspended-heading">Account suspended</h1>
              <p className="text-muted-foreground text-sm mt-2">
                Your account has been suspended due to a violation of TRYBE's community guidelines.
              </p>
            </div>

            <div className="border border-border rounded-xl bg-card/60 p-6 shadow-md stagger-2 animate-fade-in-up">
              <div className="flex items-center gap-2.5 bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2.5 mb-5">
                <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-foreground">
                  While suspended, you cannot access the platform, participate in tables, or send messages.
                </p>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                If you believe this was made in error, you can submit a reactivation request below. The admin team will review your appeal.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="appeal-email" className="mb-1.5">Your email address</Label>
                  <Input
                    id="appeal-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="The email associated with your account"
                    required
                    data-testid="input-appeal-email"
                  />
                </div>

                <div>
                  <Label htmlFor="appeal-message" className="mb-1.5">Your message to the admin team</Label>
                  <Textarea
                    id="appeal-message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Explain why you believe your account should be reactivated..."
                    rows={5}
                    className="resize-none"
                    required
                    data-testid="input-appeal-message"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Minimum 20 characters</p>
                </div>

                <Button type="submit" disabled={loading} className="w-full" data-testid="button-submit-appeal">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Submit reactivation request
                </Button>
              </form>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              <Link href="/login" className="text-foreground hover-elevate">Back to sign in</Link>
            </p>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Please review the{" "}
                <Link href="/code-of-conduct" className="underline">Code of Conduct</Link>
                {" "}before submitting your appeal.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
