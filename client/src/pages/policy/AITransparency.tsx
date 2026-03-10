export default function AITransparency() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-2">How OMNI works</h1>
        <p className="text-muted-foreground text-sm mb-8">Transparency about how artificial intelligence is used in TRYBE</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">OMNI uses artificial intelligence to:</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>Suggest relevant tables</li>
              <li>Highlight milestones</li>
              <li>Summarise discussions</li>
              <li>Help draft messages</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">It does not:</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>Provide medical advice</li>
              <li>Act on your behalf without approval</li>
              <li>Take policy positions</li>
            </ul>
          </section>

          <section>
            <p className="text-foreground font-medium">All suggestions remain under your control.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Data and privacy</h2>
            <p>Your conversations with OMNI are sent to OpenAI for processing. OpenAI does not use your data to train models. Conversation history is stored on TRYBE's servers for continuity. You may request deletion at any time.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Feedback</h2>
            <p>If OMNI gives you an unhelpful, inaccurate, or inappropriate response, please use the Feedback section to let us know. This helps us improve.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
