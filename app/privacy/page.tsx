import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Aligned',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-zinc-100 mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert prose-zinc">
          <p className="text-zinc-400 mb-6">
            <strong>Last updated:</strong> December 30, 2024
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">What we collect</h2>
            <p className="text-zinc-400">
              When you sign in with Google, we collect your name, email address, and profile picture 
              to create your account. We also store the questions you post, your votes, and comments.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">How we use your data</h2>
            <p className="text-zinc-400">
              Your data is used solely to provide the Aligned service - displaying your profile, 
              showing your public votes, and calculating compatibility with other users. We do not 
              sell your data to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Public vs. private</h2>
            <p className="text-zinc-400">
              By default, your votes are public and visible to other users. You can choose to vote 
              privately on individual questions - private votes are never revealed to other users.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Data storage</h2>
            <p className="text-zinc-400">
              Your data is stored securely using Supabase, with servers located in the United States. 
              We use industry-standard security practices to protect your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Deleting your data</h2>
            <p className="text-zinc-400">
              You can delete your account and all associated data at any time by contacting us. 
              Upon deletion, your votes, comments, and questions will be permanently removed.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-200 mb-3">Contact</h2>
            <p className="text-zinc-400">
              For any privacy-related questions, please reach out to us through the app.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

