import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Welcome() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <div className="min-h-screen bg-background auth-dots flex items-center justify-center px-6 relative overflow-hidden">
      <div className="auth-glow absolute inset-0 pointer-events-none" />
      <div className="max-w-md w-full text-center relative z-10 animate-fade-in-up">
        <div className="border border-border rounded-md bg-card/60 p-8 shadow-md">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-3" data-testid="text-welcome-heading">
            Welcome to TRYBE{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-muted-foreground leading-relaxed mb-8" data-testid="text-welcome-body">
            Your access has been confirmed.
            Please take a moment to set up your workspace.
          </p>
          <Link href="/app/onboarding">
            <Button size="lg" data-testid="button-welcome-continue">Continue</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
