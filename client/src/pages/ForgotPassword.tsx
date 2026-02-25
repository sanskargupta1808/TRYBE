import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-3">Check your email</h1>
          <p className="text-muted-foreground mb-8">If an account exists for {email}, we've sent a reset link. Please check your inbox.</p>
          <Link href="/login"><Button variant="outline">Back to sign in</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/login" className="flex items-center gap-2 text-muted-foreground text-sm mb-8 hover-elevate">
          <ArrowLeft className="h-4 w-4" />Back to sign in
        </Link>
        <h1 className="text-2xl font-semibold mb-2">Reset your password</h1>
        <p className="text-muted-foreground text-sm mb-6">Enter your email and we'll send you a reset link.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-1.5">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus data-testid="input-email" />
          </div>
          <Button type="submit" className="w-full" data-testid="button-send-reset">Send reset link</Button>
        </form>
      </div>
    </div>
  );
}
