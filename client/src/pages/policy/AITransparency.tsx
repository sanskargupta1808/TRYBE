export default function AITransparency() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-2">AI Transparency</h1>
        <p className="text-muted-foreground text-sm mb-8">How TRYBE Assistant works and what it can and cannot do</p>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">What TRYBE Assistant is</h2>
            <p>TRYBE Assistant is an AI-powered interface that helps members navigate the platform, surface relevant moments and tables, and draft questions or summaries. It is powered by OpenAI's GPT-4o-mini model and is explicitly AI-led — not human-led.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">What it can do</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>Suggest relevant tables based on your stated focus areas</li>
              <li>Summarise upcoming Moments and explain their relevance</li>
              <li>Help draft professional contributions or messages</li>
              <li>Answer general questions about how TRYBE works</li>
              <li>Surface connections or context you might have missed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">What it cannot do</h2>
            <ul className="list-disc pl-4 space-y-1">
              <li>Access private DMs or restricted table content</li>
              <li>Take actions on your behalf (join tables, send messages) without your explicit confirmation</li>
              <li>Provide clinical advice, diagnosis, or treatment recommendations</li>
              <li>Guarantee factual accuracy — always verify health information from authoritative sources</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Data and privacy</h2>
            <p>Your conversations with TRYBE Assistant are sent to OpenAI for processing. OpenAI does not use your data to train models (we operate under their API data privacy settings). Conversation history is stored on TRYBE's servers for continuity. You may request deletion at any time.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Human oversight</h2>
            <p>TRYBE Assistant does not make moderation decisions, approve or reject members, or take any consequential platform action. These are always handled by the human admin team. The assistant's suggestions are advisory only.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">Feedback</h2>
            <p>If TRYBE Assistant gives you an unhelpful, inaccurate, or inappropriate response, please use the Feedback section to let us know. This helps us improve prompting and evaluation.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
