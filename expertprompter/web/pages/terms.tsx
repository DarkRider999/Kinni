import LegalPage, { contactEmail } from '@/components/LegalPage';

export default function Terms() {
  const contact = contactEmail ? <a className="underline" href={`mailto:${contactEmail}`}>{contactEmail}</a> : 'the site owner';
  return (
    <LegalPage title="Terms of Service">
      <p>By using ExpertPrompter you agree to these terms.</p>

      <h2>Free plan</h2>
      <p>Each account includes 5 free prompt generations. Creating extra accounts to get more free prompts is not allowed.</p>

      <h2>Premium</h2>
      <ul>
        <li>Premium costs $10 per month (USD) and gives unlimited prompt generations.</li>
        <li>It renews automatically each month until you cancel. You can cancel any time from the Billing button, and you keep Premium until the end of the paid period.</li>
        <li>Payments are processed by Stripe. Past payments are not refunded except where required by law.</li>
      </ul>

      <h2>Your content</h2>
      <p>You own what you type and the prompts you generate. You are responsible for how you use them and for following the terms of the AI tools you paste them into.</p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t use the service for anything illegal, to harm others, or to attack or overload the service.</p>

      <h2>No warranty</h2>
      <p>The service is provided as is. Generated prompts are suggestions; check results before relying on them.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: {contact}.</p>
    </LegalPage>
  );
}
