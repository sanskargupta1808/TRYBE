export default function CodeOfConduct() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Professional conduct standards</h1>
        <p className="text-muted-foreground text-sm mb-8">TRYBE is a focused collaboration environment for global health.</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Please:</h2>
            <ul className="list-disc pl-4 space-y-2">
              <li>Keep discussions respectful and relevant</li>
              <li>Avoid harassment or discriminatory language</li>
              <li>Avoid profanity</li>
              <li>Avoid misinformation</li>
              <li>Respect confidentiality</li>
            </ul>
          </section>

          <section>
            <p>Violations may result in suspension.</p>
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
