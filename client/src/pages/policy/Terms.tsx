export default function Terms() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Terms of Use</h1>
        <p className="text-muted-foreground text-sm mb-8">Effective: 1 January 2026 · Alpha period</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Acceptance</h2>
            <p>By accessing or using TRYBE, you agree to these Terms. If you do not agree, you must not use the platform.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Eligibility</h2>
            <p>TRYBE is a private professional platform. Access requires a valid invite code and admin approval. You must be a professional in the global health sector and provide accurate information during registration.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Acceptable use</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>Use TRYBE for professional collaboration, information sharing, and network-building in global health</li>
              <li>Treat all members with respect and professional courtesy</li>
              <li>Do not post misinformation, promotional content, or off-topic material</li>
              <li>Do not attempt to access other accounts or the underlying infrastructure</li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Content and ownership</h2>
            <p>You retain ownership of content you create on TRYBE. By posting, you grant TRYBE a limited license to display and distribute your content within the platform. We do not claim ownership of your ideas or contributions.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Moderation</h2>
            <p>TRYBE reserves the right to review, remove, or restrict content and user access where these Terms or the Code of Conduct are breached. Decisions are made by the admin team and are subject to appeal.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Alpha status</h2>
            <p>TRYBE is in Alpha. Features may change without notice. We aim to preserve your data and contributions, but cannot guarantee service continuity during this phase.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
