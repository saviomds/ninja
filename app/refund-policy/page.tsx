import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = { title: "Refund & Warranty Policy" };

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 lg:px-8 pt-28 pb-20">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#2563EB] mb-3">Legal</p>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Refund &amp; Warranty Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-6">
            <p className="font-semibold text-blue-900 dark:text-blue-200">
              🛡️ All repairs at Tech Ninja carry a <strong>2-year warranty</strong> on parts and labour. Products purchased from us carry a <strong>1-year warranty</strong> or the manufacturer warranty, whichever is longer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Returns — Products</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You may return an unused product in its original packaging within <strong>7 days</strong> of purchase for a full refund or exchange</li>
              <li>Products must be in original condition with all accessories and packaging</li>
              <li>Software-unlocked or opened consumables (screen protectors, cases) cannot be returned unless defective</li>
              <li>To initiate a return, contact us at <a href="mailto:hello@techninja.mu" className="text-[#2563EB]">hello@techninja.mu</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Repairs — Warranty Claims</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>If a repair fails within the 2-year warranty period, we will re-do the repair at no charge</li>
              <li>Warranty is void if the device has been opened or tampered with by a third party after our repair</li>
              <li>Physical damage occurring after the repair is not covered</li>
              <li>Bring your device and your repair receipt to claim warranty</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Refund Process</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Approved refunds are processed within <strong>5–7 business days</strong></li>
              <li>Refunds are issued via the original payment method or as store credit</li>
              <li>Delivery fees are non-refundable unless the return is due to our error</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Non-Refundable Items</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Digital products and software licences</li>
              <li>Repair labour charges (unless repair warranty applies)</li>
              <li>Devices with water damage that was not disclosed at drop-off</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Contact for Returns</h2>
            <p>Email <a href="mailto:hello@techninja.mu" className="text-[#2563EB] hover:underline">hello@techninja.mu</a> or visit us in Port Louis with your proof of purchase.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
