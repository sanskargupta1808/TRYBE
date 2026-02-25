import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, ArrowLeft, Loader2 } from "lucide-react";

export default function RequestInvite() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "", organisation: "", roleTitle: "", email: "", focusAreas: "", reason: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/invite-requests", form);
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-3">Request received</h1>
          <p className="text-muted-foreground leading-relaxed mb-8">
            Thank you. We'll review your request and be in touch shortly.
          </p>
          <Link href="/">
            <Button variant="outline">Return to home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-6 py-16">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground text-sm mb-10 hover-elevate">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-3">Request access to TRYBE</h1>
          <p className="text-muted-foreground leading-relaxed">
            TRYBE is currently in private Alpha. We review each request carefully to maintain a trusted and purposeful environment. Please share a few details about your role and areas of focus.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="mb-1.5">Full name</Label>
              <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required data-testid="input-name" />
            </div>
            <div>
              <Label htmlFor="email" className="mb-1.5">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required data-testid="input-email" />
            </div>
          </div>
          <div>
            <Label htmlFor="organisation" className="mb-1.5">Organisation</Label>
            <Input id="organisation" value={form.organisation} onChange={e => setForm(f => ({ ...f, organisation: e.target.value }))} required data-testid="input-organisation" />
          </div>
          <div>
            <Label htmlFor="role" className="mb-1.5">Role</Label>
            <Input id="role" value={form.roleTitle} onChange={e => setForm(f => ({ ...f, roleTitle: e.target.value }))} required data-testid="input-role" />
          </div>
          <div>
            <Label htmlFor="focus" className="mb-1.5">Primary areas of focus</Label>
            <Input id="focus" placeholder="e.g. rare disease, mental health, Asia-Pacific" value={form.focusAreas} onChange={e => setForm(f => ({ ...f, focusAreas: e.target.value }))} data-testid="input-focus" />
          </div>
          <div>
            <Label htmlFor="reason" className="mb-1.5">Why would TRYBE be useful to you? (optional)</Label>
            <Textarea id="reason" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} data-testid="input-reason" />
          </div>
          <Button type="submit" disabled={loading} className="w-full" data-testid="button-submit-request">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit request
          </Button>
        </form>
      </div>
    </div>
  );
}
