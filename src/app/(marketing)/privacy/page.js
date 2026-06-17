import Container from "@/components/ui/Container";

export const metadata = {
  title: "Privacy Policy | Nanozen",
  description: "Privacy Policy for Nanozen.",
};

export default function PrivacyPolicy() {
  return (
    <div className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_70%)]" />
      </div>

      <Container className="max-w-3xl relative z-10">
        <div className="space-y-8">
          <div className="border-b border-border pb-8">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Privacy Policy</h1>
            <p className="mt-4 text-base text-muted">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="space-y-8 text-muted-strong leading-relaxed">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">1. Introduction</h2>
              <p>
                Welcome to Nanozen, an AI-powered banner generation platform operated by GemAI Pvt. Ltd. (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">2. Data We Collect</h2>
              <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
              <ul className="list-disc pl-5 space-y-2 text-muted">
                <li><strong className="text-muted-strong">Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
                <li><strong className="text-muted-strong">Contact Data:</strong> includes email address.</li>
                <li><strong className="text-muted-strong">Content Data:</strong> includes text briefs, reference images, and subject images you upload to our platform to generate banners.</li>
                <li><strong className="text-muted-strong">Technical Data:</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, operating system and platform.</li>
                <li><strong className="text-muted-strong">Usage Data:</strong> includes information about how you use our website and services, including generation run history and output scores.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">3. How We Use Your Data</h2>
              <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
              <ul className="list-disc pl-5 space-y-2 text-muted">
                <li>To provide and maintain our service, including processing your inputs with AI models to generate banners.</li>
                <li>To manage your account and provide customer support.</li>
                <li>To improve our platform, including fine-tuning and analyzing our scoring systems and models.</li>
                <li>To communicate with you about updates, security alerts, and support messages.</li>
              </ul>
              <p className="mt-4">
                <strong>Note on AI Processing:</strong> Your prompts and uploaded images are processed using third-party AI providers (such as OpenAI and OpenRouter). While we securely transmit your data to these providers solely for the purpose of generating your banners, we encourage you to review their respective privacy policies regarding data retention.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">4. Data Security</h2>
              <p>
                We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. We use Supabase for secure authentication and database storage, ensuring industry-standard security practices, including Row Level Security (RLS) to isolate user data.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">5. Your Legal Rights</h2>
              <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to:</p>
              <ul className="list-disc pl-5 space-y-2 text-muted">
                <li>Request access to your personal data.</li>
                <li>Request correction of your personal data.</li>
                <li>Request erasure of your personal data.</li>
                <li>Object to processing of your personal data.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">6. Contact Us</h2>
              <p>
                If you have any questions about this privacy policy or our privacy practices, please contact us at <a href="mailto:privacy@nanozen.com" className="text-primary transition-colors hover:text-primary/80 hover:underline">privacy@nanozen.com</a>.
              </p>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}
