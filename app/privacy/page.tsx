import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = { title: "Privacy Policy" };

const LAST_UPDATED = "June 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 lg:px-8 pt-28 pb-20">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#2563EB] mb-3">Legal</p>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Who We Are</h2>
            <p>Tech Ninja (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the techninja.mu platform. We are a technology retail and repair service based in Port Louis, Mauritius.</p>
            <p className="mt-2">Contact: <a href="mailto:hello@techninja.mu" className="text-[#2563EB] hover:underline">hello@techninja.mu</a></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. Information We Collect</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li><strong>Account data:</strong> name, email address when you register</li>
              <li><strong>Order data:</strong> name, phone, delivery address, order details</li>
              <li><strong>Repair data:</strong> device model, fault description, contact info</li>
              <li><strong>Usage data:</strong> pages visited, device type, browser (via analytics)</li>
              <li><strong>Payment data:</strong> we do not store card numbers — payments processed by third-party providers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>To process and fulfil orders and repairs</li>
              <li>To send order confirmations and repair status updates</li>
              <li>To send newsletters you have opted into (unsubscribe any time)</li>
              <li>To improve our platform and services</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Data Storage & Security</h2>
            <p>Your data is stored on Supabase infrastructure (PostgreSQL databases with row-level security). We use industry-standard encryption in transit (TLS) and at rest. We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. Cookies</h2>
            <p>We use essential cookies for authentication and a localStorage key (<code>tn-theme</code>, <code>tn-wishlist</code>) for preferences. We do not use third-party advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data at any time. Email <a href="mailto:hello@techninja.mu" className="text-[#2563EB] hover:underline">hello@techninja.mu</a> with your request. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">7. Third-Party Services</h2>
            <p>We use Supabase (database), Resend (transactional email), and Vercel (hosting). Each has their own privacy policy. We do not share your data beyond what is necessary to deliver our services.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">8. Changes</h2>
            <p>We may update this policy. Material changes will be notified via email or a notice on the site. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">9. Contact</h2>
            <p>For privacy questions: <a href="mailto:hello@techninja.mu" className="text-[#2563EB] hover:underline">hello@techninja.mu</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
