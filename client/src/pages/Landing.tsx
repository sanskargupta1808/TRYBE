import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Shield, Calendar, Bot, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">T</span>
            </div>
            <span className="font-semibold text-foreground">TRYBE</span>
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

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <Badge variant="secondary" className="mb-6">Invite-only Alpha</Badge>
          <h1 className="text-5xl font-semibold tracking-tight text-foreground leading-tight mb-6">
            A Calm Space for Global<br />Health Collaboration
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-4 max-w-2xl mx-auto">
            TRYBE is a private, invite-only working environment for professionals across global health.
          </p>
          <p className="text-base text-muted-foreground mb-10 font-medium">
            Human-led. AI-supported. Fully user-controlled.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/request-invite">
              <Button size="lg" data-testid="button-hero-request">Request an invitation</Button>
            </Link>
            <a href="#why">
              <Button size="lg" variant="outline" data-testid="button-hero-learn">Learn more</Button>
            </a>
          </div>
        </div>
      </section>

      {/* Why TRYBE */}
      <section id="why" className="max-w-4xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-semibold mb-4">Why TRYBE exists</h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Global health work is often fragmented. Conversations happen in silos, key moments pass
              without coordination, and collaboration is harder than it should be. TRYBE provides a calm,
              structured place to connect and move work forward.
            </p>
          </div>
          <div className="space-y-4">
            <div className="bg-card border border-card-border rounded-md p-5">
              <p className="font-medium text-foreground mb-1">No feeds. No follower counts. No public connection graphs.</p>
              <p className="text-muted-foreground text-sm">TRYBE is built for signal, trust, and purposeful coordination.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-semibold text-center mb-12">What makes TRYBE different</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Users, title: "Structured collaboration tables", desc: "Purpose-driven working spaces for focused coordination, not open forums." },
              { icon: Calendar, title: "2026 health calendar backbone", desc: "A curated set of health milestones to anchor collaboration and planning." },
              { icon: Shield, title: "Professional moderation", desc: "Human-led oversight with AI assistance to maintain a trusted environment." },
              { icon: Bot, title: "TRYBE Assistant", desc: "A calm AI companion that suggests, but never acts without your approval." },
              { icon: CheckCircle, title: "Full user control", desc: "You decide what you share, who you connect with, and how active the assistant is." },
              { icon: Shield, title: "Invite-only access", desc: "Curated membership to preserve signal quality and professional trust." },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-card-border rounded-md p-5 hover-elevate">
                <f.icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-medium text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRYBE Assistant */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-semibold mb-4">TRYBE Assistant</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">TRYBE Assistant supports your work across the platform.</p>
            <div className="space-y-3">
              {[
                "Suggest relevant tables",
                "Highlight upcoming health moments",
                "Help draft messages",
                "Summarise discussions",
                "Offer introductions — with your approval",
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
                "Replace your judgment",
              ].map(it => (
                <div key={it} className="flex items-start gap-2">
                  <div className="w-4 h-4 mt-0.5 flex-shrink-0 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">{it}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="bg-primary/5 border-y border-border">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-semibold mb-4">Who it's for</h2>
          <p className="text-muted-foreground mb-8">TRYBE is designed for:</p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Patient advocates", "Public health professionals", "Policymakers", "Clinical research teams", "Health NGOs", "Responsible industry medical teams"].map(t => (
              <Badge key={t} variant="secondary" className="text-sm py-1.5 px-3">{t}</Badge>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold mb-4">Ready to request access?</h2>
        <p className="text-muted-foreground mb-8">TRYBE is currently in private Alpha. We review requests carefully to protect a safe and purposeful environment.</p>
        <Link href="/request-invite">
          <Button size="lg" data-testid="button-cta-request">Request an invitation</Button>
        </Link>
      </section>

      {/* Footer */}
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
