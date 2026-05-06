import Link from "next/link";

import { LegalSection } from "../_components/legal-section";

export const metadata = { title: "Terms of Service · Laude Design" };

const LAST_UPDATED = "May 5, 2026";

export default function TermsPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Legal
        </p>
        <h1 className="font-sketch text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Terms of Service
        </h1>
        <p className="text-sm text-ink-subtle">Last updated {LAST_UPDATED}</p>
      </header>

      <p className="text-[15px] leading-7 text-ink-muted">
        These Terms govern your use of Laude Design (&ldquo;Laude Design,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;), an open-source agentic design
        workspace. By creating an account or otherwise using the service, you
        agree to these Terms. If you don&rsquo;t agree, please don&rsquo;t use
        Laude Design.
      </p>

      <LegalSection title="1. The service">
        <p>
          Laude Design is a self-hostable, open-source workspace for designing
          with AI agents. You bring your own API keys for third-party model
          providers (such as Anthropic, OpenAI, or Google), and the agent uses
          those models to help you create and iterate on design work.
        </p>
        <p>
          The hosted version of Laude Design is provided for convenience. You
          are also free to clone the repository and run your own instance under
          the project&rsquo;s open-source license.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <p>
          You sign in through Google or GitHub OAuth. You&rsquo;re responsible
          for keeping your sign-in provider secure, and for all activity that
          happens under your account. You must be at least 13 years old (or the
          minimum age of digital consent in your country) to use Laude Design.
        </p>
      </LegalSection>

      <LegalSection title="3. API keys and third-party models">
        <p>
          Laude Design does not provide model inference. When you add an API
          key, you authorize Laude Design to send your prompts, files, and
          Skills to the corresponding provider on your behalf so the agent can
          respond. Keys are encrypted at rest with AES-256-GCM before being
          stored &mdash; see our{" "}
          <Link href="/privacy#api-keys-and-encryption">Privacy Policy</Link>{" "}
          for details on how key material is handled.
        </p>
        <ul>
          <li>
            <strong>You are responsible</strong> for any usage charges, rate
            limits, or policy enforcement from the providers whose keys you
            add.
          </li>
          <li>
            <strong>You must comply</strong> with the terms and acceptable use
            policies of every provider you connect (Anthropic, OpenAI, Google,
            and others).
          </li>
          <li>
            <strong>Don&rsquo;t share keys you don&rsquo;t own.</strong> Only
            add keys you have permission to use, and don&rsquo;t resell access
            to your keys through Laude Design.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>
          You retain all rights to the projects, designs, prompts, and Skills
          you create or upload. We don&rsquo;t claim ownership over your work,
          and we don&rsquo;t use it to train models.
        </p>
        <p>
          You grant us a limited license to store, process, and transmit your
          content solely as needed to operate the service for you &mdash; for
          example, to render your projects in the editor or relay your prompts
          to the model provider you&rsquo;ve chosen.
        </p>
      </LegalSection>

      <LegalSection title="5. Public Skills">
        <p>
          When you mark a Skill as public, you grant other Laude Design users a
          worldwide, royalty-free license to view, copy, and use that Skill
          inside the product. You can unpublish a Skill at any time, but copies
          made before then may continue to exist in other users&rsquo;
          workspaces.
        </p>
        <p>
          Don&rsquo;t publish Skills containing other people&rsquo;s
          proprietary content, secrets, or anything you don&rsquo;t have the
          right to share.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>You agree not to use Laude Design to:</p>
        <ul>
          <li>Violate any law or another person&rsquo;s rights;</li>
          <li>
            Generate or distribute content that is illegal, harmful, deceptive,
            or sexually explicit involving minors;
          </li>
          <li>
            Attempt to break, abuse, or reverse engineer the security of the
            service, including the systems that store encrypted API keys;
          </li>
          <li>
            Run automated scraping, denial-of-service attacks, or use the
            product to send spam;
          </li>
          <li>
            Resell, sublicense, or otherwise commercialize access to API keys
            you&rsquo;ve added.
          </li>
        </ul>
        <p>
          We may suspend or terminate accounts that violate these rules,
          especially when needed to protect other users or the providers we
          relay traffic to.
        </p>
      </LegalSection>

      <LegalSection title="7. Open source">
        <p>
          The Laude Design source code is available on{" "}
          <a
            href="https://github.com/DenardYap/laude-design"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>{" "}
          under the license described in the repository. These Terms apply to
          your use of the hosted service; the open-source license governs your
          rights to the code itself.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p>
          Laude Design is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
          <strong>&ldquo;as available,&rdquo;</strong> without warranties of
          any kind, whether express or implied, including warranties of
          merchantability, fitness for a particular purpose, or
          non-infringement. AI-generated output can be inaccurate, biased, or
          unsuitable for your use case &mdash; review it before relying on it.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, Laude Design and its
          maintainers will not be liable for any indirect, incidental, special,
          or consequential damages, or for lost profits, revenue, data, or
          goodwill arising out of your use of the service. Our total
          liability for any claim relating to the service will not exceed the
          greater of (a) the fees you paid us in the prior twelve months or
          (b) USD $50.
        </p>
      </LegalSection>

      <LegalSection title="10. Termination">
        <p>
          You can stop using Laude Design at any time and delete your account
          from the workspace settings. We can suspend or terminate your access
          if you breach these Terms or if continued service would expose us or
          other users to risk. On termination, your stored content may be
          deleted as described in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to these Terms">
        <p>
          We may update these Terms as the product evolves. When we make
          material changes, we&rsquo;ll update the &ldquo;Last updated&rdquo;
          date above and, where appropriate, notify you in-product. Continuing
          to use Laude Design after a change means you accept the updated
          Terms.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Questions about these Terms? Open an issue on the{" "}
          <a
            href="https://github.com/DenardYap/laude-design/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub repository
          </a>
          .
        </p>
      </LegalSection>
    </div>
  );
}
