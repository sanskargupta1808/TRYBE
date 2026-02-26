import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Shield, Calendar, Bot, Users, X } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-10 border-b border-border bg-background/60 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/trybe-logo.png" alt="TRYBE" className="h-[84px] w-auto" />
            <Badge variant="secondary" className="text-xs">Alpha</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="link-login">Sign in</Button>
            </Link>
            <Link href="/request-invite">
              <Button size="sm" data-testid="link-request-invite">Request an invitation</Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-background">
        <div className="max-w-4xl mx-auto px-6 py-28 text-center">
          <Badge variant="secondary" className="mb-6 animate-fade-in">Invite-only Alpha</Badge>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-foreground leading-[1.1] mb-6 animate-fade-in-up">
            A private space for serious<br />health collaboration
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-4 max-w-2xl mx-auto font-medium animate-fade-in-up stagger-1" style={{ fontWeight: 400 }}>
            TRYBE is an invite-only working environment for people across global health.
            No feeds. No noise. Just focused collaboration, supported by intelligent assistance.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mt-10 animate-fade-in-up stagger-2">
            <Link href="/request-invite">
              <Button size="lg" className="shadow-md hover:shadow-lg transition-shadow cta-glow" data-testid="button-hero-request">Request an invitation</Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="outline" data-testid="button-hero-learn">Learn how it works</Button>
            </a>
          </div>
        </div>
      </section>

      <section id="why" className="max-w-4xl mx-auto px-6 py-24 border-t border-border/50">
        <h2 className="text-3xl font-semibold mb-6 heading-rule">Why TRYBE exists</h2>
        <p className="text-muted-foreground leading-relaxed text-lg mb-8 max-w-3xl">
          Global health work is often fragmented.
        </p>
        <div className="space-y-4 max-w-3xl">
          <div className="bg-card border border-card-border rounded-xl p-5">
            <p className="text-muted-foreground leading-relaxed">
              Conversations happen in silos.
              Important milestones pass without coordination.
              The right people don't always connect at the right time.
            </p>
          </div>
          <p className="text-foreground leading-relaxed text-lg">
            TRYBE provides a calm, structured place to bring the right people together around shared priorities.
          </p>
        </div>
      </section>

      <section id="how" className="bg-muted/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <h2 className="text-3xl font-semibold text-center mb-4">What makes TRYBE different</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            There are no public feeds. No follower counts. No popularity algorithms.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Users, title: "Focused tables", desc: "Purpose-driven working areas organised by topic or initiative." },
              { icon: Calendar, title: "A 2026 health milestone calendar", desc: "A curated set of awareness days, congresses, and policy windows." },
              { icon: Shield, title: "Professional moderation", desc: "Human-led oversight with AI assistance to maintain a trusted environment." },
              { icon: Bot, title: "A personal assistant that supports your work", desc: "Suggests, summarises, and drafts — but never acts without your approval." },
              { icon: CheckCircle, title: "Full user control", desc: "You decide what to join. You decide who to connect with. The system supports you — it doesn't direct you." },
              { icon: Shield, title: "Invite-only access", desc: "Curated membership to preserve trust and professional quality." },
            ].map((f, i) => (
              <div key={f.title} className="bg-card border border-card-border rounded-xl p-6 hover-elevate hover:shadow-md transition-shadow duration-200">
                <f.icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-medium text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-24 border-t border-border/50">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-semibold mb-4 heading-rule">TRYBE Assistant</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed mt-4">Every member has access to TRYBE Assistant. It can:</p>
            <div className="space-y-3">
              {[
                "Suggest relevant tables",
                "Highlight upcoming health milestones",
                "Help you draft or refine messages",
                "Summarise discussions",
                "Suggest introductions (with your approval)",
              ].map(it => (
                <div key={it} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">{it}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-4 font-medium text-sm">It does not:</p>
            <div className="space-y-2">
              {[
                "Act without your consent",
                "Provide medical advice",
                "Take policy positions",
                "Replace your judgement",
              ].map(it => (
                <div key={it} className="flex items-start gap-2">
                  <X className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{it}</span>
                </div>
              ))}
            </div>
            <p className="text-sm font-medium text-foreground mt-6 font-serif italic">Human-led. AI-supported.</p>
          </div>
        </div>
      </section>

      <section className="bg-primary/5 border-y border-border">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold mb-4">Who it's for</h2>
          <p className="text-muted-foreground mb-8">TRYBE is designed for people working across global health, including:</p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Patient advocates", "Public health professionals", "Policy advisors", "Clinical research teams", "NGOs", "Responsible industry medical teams"].map(t => (
              <Badge key={t} variant="secondary" className="text-sm py-1.5 px-3">{t}</Badge>
            ))}
          </div>
          <p className="text-muted-foreground text-sm mt-6">Currently invite-only during Alpha.</p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold mb-4">Ready to request access?</h2>
        <p className="text-muted-foreground mb-8">We review each request carefully to maintain a trusted and purposeful environment.</p>
        <Link href="/request-invite">
          <Button size="lg" className="shadow-md hover:shadow-lg transition-shadow cta-glow" data-testid="button-cta-request">Request an invitation</Button>
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground text-center md:text-left">
              TRYBE is a neutral collaboration environment. It does not provide medical advice or take institutional policy positions.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              {[["Privacy Policy", "/privacy"], ["Terms", "/terms"], ["Code of Conduct", "/code-of-conduct"], ["AI Transparency", "/ai-transparency"]].map(([label, url]) => (
                <Link key={url} href={url} className="text-xs text-muted-foreground hover-elevate">{label}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
