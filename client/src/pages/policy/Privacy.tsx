export default function Privacy() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto prose prose-sm">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-8">Effective: 1 January 2026 · Alpha period</p>

        <section className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-2">Who we are</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">TRYBE is a private, invite-only global health collaboration platform. During the Alpha period, access is strictly controlled and all members are verified professionals.</p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-2">What we collect</h2>
          <ul className="text-muted-foreground text-sm space-y-1 list-disc pl-4">
            <li>Account information: name, email, organisation, professional role</li>
            <li>Profile data: disease area interests, regions, current focus</li>
            <li>Platform activity: posts, threads, table participation, calendar signals</li>
            <li>Technical data: session identifiers, access logs</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-2">How we use it</h2>
          <ul className="text-muted-foreground text-sm space-y-1 list-disc pl-4">
            <li>To operate the platform and facilitate professional collaboration</li>
            <li>To power OMNI suggestions (processed by OpenAI; no training on your data)</li>
            <li>To keep the platform safe and moderated</li>
            <li>To improve TRYBE based on aggregated, anonymised usage patterns</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-2">What we do not do</h2>
          <ul className="text-muted-foreground text-sm space-y-1 list-disc pl-4">
            <li>We do not sell your data to any third party</li>
            <li>We do not use your data for advertising</li>
            <li>We do not share your identity with other members without your consent</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-2">Your rights</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">You may request access, correction, or deletion of your data at any time by contacting the TRYBE admin team. We aim to respond within 30 days.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Changes to this policy</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">We will notify all members of material changes to this policy before they take effect.</p>
        </section>
      </div>
    </div>
  );
}
