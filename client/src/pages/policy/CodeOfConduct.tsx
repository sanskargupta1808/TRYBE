export default function CodeOfConduct() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Code of Conduct</h1>
        <p className="text-muted-foreground text-sm mb-8">The TRYBE standard for professional behaviour</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Our commitment</h2>
            <p>TRYBE is built for serious professional collaboration in global health. Every member shares responsibility for maintaining an environment that is safe, respectful, and substantive.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">What we expect</h2>
            <ul className="list-disc pl-4 space-y-2">
              <li><strong className="text-foreground">Professionalism.</strong> Engage as you would at a high-stakes professional conference. Maintain the quality of discourse at all times.</li>
              <li><strong className="text-foreground">Accuracy.</strong> Share information you have a reasonable basis to believe is correct. Clearly signal when expressing opinion or hypothesis.</li>
              <li><strong className="text-foreground">Respect.</strong> Disagree thoughtfully. Critique ideas, not people. No personal attacks, name-calling, or targeted harassment.</li>
              <li><strong className="text-foreground">Inclusion.</strong> TRYBE connects professionals across countries, disciplines, and sectors. Treat diversity as a strength.</li>
              <li><strong className="text-foreground">Relevance.</strong> Keep contributions focused on the purpose of each table and thread. Avoid off-topic, promotional, or self-serving content.</li>
              <li><strong className="text-foreground">Confidentiality.</strong> Do not share content from private threads, DMs, or restricted tables outside the platform without permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">What is not acceptable</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>Harassment, discrimination, or intimidation of any kind</li>
              <li>Sharing unverified claims as fact, particularly regarding health outcomes</li>
              <li>Commercial promotion or unsolicited outreach</li>
              <li>Sharing other members' information without their consent</li>
              <li>Attempting to circumvent access controls or the moderation system</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Enforcement</h2>
            <p>The TRYBE admin team reviews all flagged content and conduct. Actions range from a private note, to content removal, to temporary suspension, to permanent removal from the platform. All decisions are documented and subject to appeal.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Reporting</h2>
            <p>Use the flag function on any post or the Feedback section to raise a concern. All reports are treated confidentially and reviewed within 48 hours during the Alpha period.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
