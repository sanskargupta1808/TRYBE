import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function PendingApproval() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold mb-3">Your account is under review</h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Thanks for registering. TRYBE is curated during Alpha to protect a safe and meaningful environment. You'll receive an email once your access is approved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={logout}>Sign out</Button>
        </div>
        <div className="mt-8 pt-6 border-t border-border">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
            {[["Privacy Policy", "/privacy"], ["Terms", "/terms"], ["Code of Conduct", "/code-of-conduct"]].map(([l, u]) => (
              <Link key={u} href={u} className="hover-elevate">{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
