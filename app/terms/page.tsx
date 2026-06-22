import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 lg:px-8 pt-28 pb-20">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#2563EB] mb-3">Legal</p>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Acceptance</h2>
            <p>By using Tech Ninja (&quot;the Platform&quot;), you agree to these Terms. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. Services</h2>
            <p>Tech Ninja provides device repair, retail sales, trade-ins, and related tech services in Mauritius. We reserve the right to modify or discontinue any service at any time.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. Orders & Purchases</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>All orders are subject to availability and acceptance by Tech Ninja</li>
              <li>Prices are listed in Mauritian Rupees (Rs / MUR) and are inclusive of VAT where applicable</li>
              <li>We reserve the right to cancel orders that contain pricing errors</li>
              <li>Delivery timelines are estimates and not guaranteed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Repairs</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>All repairs carry a 2-year warranty on parts and labour</li>
              <li>Warranty is void if the device has been tampered with after repair</li>
              <li>We are not liable for data loss — back up your device before leaving it for repair</li>
              <li>Uncollected devices after 90 days may be disposed of after reasonable notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. User Accounts</h2>
            <p>You are responsible for maintaining the security of your account. You must not share account credentials or use another person&apos;s account. We may suspend accounts that violate these Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. Prohibited Use</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Submitting false or fraudulent orders or reviews</li>
              <li>Attempting to gain unauthorised access to any part of the Platform</li>
              <li>Using the Platform for any illegal purpose under Mauritius law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">7. Intellectual Property</h2>
            <p>All content on the Platform — including text, images, logos and code — is owned by Tech Ninja or its licensors and may not be reproduced without written permission.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by Mauritius law, Tech Ninja shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid for the specific service giving rise to the claim.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">9. Governing Law</h2>
            <p>These Terms are governed by the laws of the Republic of Mauritius. Disputes shall be resolved in the courts of Mauritius.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">10. Contact</h2>
            <p>Questions? Email <a href="mailto:hello@techninja.mu" className="text-[#2563EB] hover:underline">hello@techninja.mu</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
