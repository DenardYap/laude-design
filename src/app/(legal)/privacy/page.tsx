import Link from "next/link";

import { LegalSection } from "../_components/legal-section";

export const metadata = { title: "Privacy Policy · Laude Design" };

const LAST_UPDATED = "May 2, 2026";

export default function PrivacyPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Legal
        </p>
        <h1 className="font-sketch text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-ink-subtle">Last updated {LAST_UPDATED}</p>
      </header>

      <p className="text-[15px] leading-7 text-ink-muted">
        This Privacy Policy describes how Laude Design (&ldquo;Laude
        Design,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, and
        protects your information when you use the hosted version of the
        product. We try to collect as little as possible &mdash; only what we
        need to keep your account, your projects, and your encrypted API keys
        working.
      </p>

      <LegalSection title="1. Information we collect">
        <p>We collect three categories of data:</p>
        <ul>
          <li>
            <strong>Account information</strong> &mdash; when you sign in with
            Google or GitHub, the OAuth provider sends us your name, email,
            avatar URL, and a stable provider ID. We don&rsquo;t see your
            password.
          </li>
          <li>
            <strong>Workspace content</strong> &mdash; the API keys, projects,
            designs, prompts, files, and Skills you create or upload while
            using the product.
          </li>
          <li>
            <strong>Operational data</strong> &mdash; basic logs (IP address,
            user agent, request timestamps, error traces) needed to run the
            service securely and debug problems.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How we use your information">
        <p>We use the data above to:</p>
        <ul>
          <li>Authenticate you and keep your session secure;</li>
          <li>
            Store and render your projects, Skills, and settings inside your
            workspace;
          </li>
          <li>
            Relay your prompts and files to the AI provider whose key
            you&rsquo;ve added so the agent can respond;
          </li>
          <li>
            Detect abuse, prevent fraud, and protect the integrity of the
            service and its users;
          </li>
          <li>
            Communicate critical product updates (security, account, terms).
          </li>
        </ul>
        <p>
          We do <strong>not</strong> sell your personal information, and we do{" "}
          <strong>not</strong> use your projects, prompts, or Skills to train
          AI models.
        </p>
      </LegalSection>

      <LegalSection title="3. API keys and encryption">
        <p>
          API keys you add are encrypted at rest using AES-256-GCM with a key
          held outside the application database. Only the encrypted ciphertext
          is persisted &mdash; the decrypted key exists in memory only for the
          moment a request is made to the corresponding provider, and is never
          logged, displayed in full, or returned to the browser after the
          initial save.
        </p>
        <p>
          You can rotate or delete a stored key at any time from the API Keys
          section of the workspace.
        </p>
      </LegalSection>

      <LegalSection title="4. Third-party AI providers">
        <p>
          Laude Design is a bring-your-own-key product. When the agent runs,
          your prompts, Skills, and any files you attach are sent to the
          provider whose key you&rsquo;ve added &mdash; for example, Anthropic
          (Claude), OpenAI (GPT), or Google (Gemini). Their handling of that
          data is governed by their own privacy policies and data-retention
          settings, not ours.
        </p>
        <p>
          Before adding a key, please review the provider&rsquo;s policy and
          configure any data-controls they offer (such as opting out of
          training).
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing of information">
        <p>We share data only in narrow circumstances:</p>
        <ul>
          <li>
            <strong>AI providers</strong> you&rsquo;ve connected, as described
            above;
          </li>
          <li>
            <strong>Infrastructure providers</strong> (hosting, database,
            error monitoring) acting as processors under contract, with access
            limited to what they need to run the service;
          </li>
          <li>
            <strong>Other users</strong>, but only for content you explicitly
            mark public &mdash; such as a Skill you publish to the community
            library;
          </li>
          <li>
            <strong>Legal authorities</strong>, when required by valid legal
            process or to protect the rights and safety of users.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p>
          We keep your account and workspace content for as long as your
          account is active. When you delete a project, Skill, or API key, it
          is removed from active systems immediately and purged from backups
          within 30 days. When you delete your account, we delete your
          workspace content within 30 days, except where we&rsquo;re required
          to retain limited records for legal or security reasons.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>
          Depending on where you live, you may have the right to access,
          correct, export, or delete your personal data, and to object to
          certain processing. You can:
        </p>
        <ul>
          <li>
            View and edit your profile and stored keys directly in the
            workspace;
          </li>
          <li>Delete your account from the workspace settings;</li>
          <li>
            Reach out via the contact channel below for any other request.
          </li>
        </ul>
        <p>
          If you&rsquo;d rather hold the data yourself, you can self-host
          Laude Design from the open-source repository.
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies and local storage">
        <p>
          We use cookies and browser local storage to keep you signed in,
          remember UI preferences (such as sidebar state and the model you
          last selected), and maintain CSRF protection on form submissions. We
          do not use third-party advertising or cross-site tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We use industry-standard practices to protect your data &mdash;
          TLS in transit, AES-256-GCM for stored API keys, scoped database
          access, and least-privilege production access. No system is perfectly
          secure, so we encourage you to use a strong sign-in provider and to
          report any suspected vulnerability through the GitHub repository.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          Laude Design is not directed to children under 13 (or the local
          minimum age of digital consent). If you believe a child has given us
          personal information, please contact us so we can remove it.
        </p>
      </LegalSection>

      <LegalSection title="11. International transfers">
        <p>
          Laude Design and its infrastructure providers may process your data
          in countries other than your own. Where required, we rely on
          standard contractual clauses or equivalent safeguards for these
          transfers.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to this policy">
        <p>
          As the product evolves we may update this policy. When we make
          material changes we&rsquo;ll update the &ldquo;Last updated&rdquo;
          date above and, where appropriate, notify you in-product before the
          change takes effect.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Questions or privacy requests can be sent by opening an issue on the{" "}
          <a
            href="https://github.com/DenardYap/laude-design/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            Laude Design repository
          </a>
          . See our <Link href="/terms">Terms of Service</Link> for the rules
          that govern your use of the product.
        </p>
      </LegalSection>
    </div>
  );
}
