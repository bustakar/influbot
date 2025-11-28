import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy for Influbot</h1>
      <p className="text-muted-foreground mb-8">Effective Date: {new Date().toLocaleDateString()}</p>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Personal Data:</strong> We collect email addresses when you sign up for an account. This is used to manage your account, authentication via Clerk, and communicate with you about your service.
            </li>
            <li>
              <strong>User Content:</strong> We collect videos that you upload for analysis.
            </li>
            <li>
              <strong>Usage Data:</strong> We may collect anonymous usage data to improve our services.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Video Processing and AI</h2>
          <p className="text-muted-foreground mb-4">
            We use Google AI services to process and analyze the videos you upload to provide feedback on your on-camera presence.
          </p>
          <p className="text-muted-foreground">
            <strong>Data Privacy with Google AI:</strong> We rely on Google Cloud's data privacy commitments. Google generally states that they do not use customer data submitted to their API services to train their models without permission. Your video data is processed solely for the purpose of generating the analysis and feedback for you.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Use of Information</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>To provide and maintain our Service.</li>
            <li>To notify you about changes to our Service.</li>
            <li>To allow you to participate in interactive features of our Service when you choose to do so.</li>
            <li>To provide customer support.</li>
            <li>To gather analysis or valuable information so that we can improve our Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Data Retention</h2>
          <p className="text-muted-foreground">
            We retain your personal information and content only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your information to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our legal agreements and policies.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have any questions about this Privacy Policy, please contact us.
          </p>
        </section>
      </div>
    </div>
  );
}

