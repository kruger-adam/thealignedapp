import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Aligned',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-zinc-100 mb-8">Terms of Service</h1>
        
        <div className="prose prose-invert prose-zinc">
          <p className="text-zinc-400 mb-6">
            <strong>Last updated:</strong> December 30, 2024
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Using Aligned</h2>
            <p className="text-zinc-400">
              Aligned is a social polling platform where users can post yes/no questions, vote, 
              and see how their opinions compare with others. By using Aligned, you agree to 
              these terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Your account</h2>
            <p className="text-zinc-400">
              You must sign in with a valid Google account to use Aligned. You are responsible 
              for all activity under your account. Keep your login credentials secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Content guidelines</h2>
            <p className="text-zinc-400">
              You agree not to post content that is illegal, hateful, harassing, or violates 
              others&apos; rights. We reserve the right to remove content and suspend accounts that 
              violate these guidelines.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Your content</h2>
            <p className="text-zinc-400">
              You retain ownership of the questions and comments you post. By posting, you grant 
              us a license to display your content on the platform. You can delete your content 
              at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">AI features</h2>
            <p className="text-zinc-400">
              Aligned includes AI-powered features that vote on questions and respond to comments. 
              AI responses are for entertainment and discussion purposes only and should not be 
              considered advice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Disclaimer</h2>
            <p className="text-zinc-400">
              Aligned is provided &quot;as is&quot; without warranties. We are not responsible for user-generated 
              content or any decisions you make based on information on the platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Changes</h2>
            <p className="text-zinc-400">
              We may update these terms from time to time. Continued use of Aligned after changes 
              constitutes acceptance of the new terms.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

