import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 py-12 mt-auto">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Tech Ninja</h2>
          <p className="text-sm leading-relaxed max-w-xs">
            Your all-in-one platform for showcasing products, announcing updates, and connecting with your audience.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h3>
          <ul className="space-y-3 text-sm">
            <li><Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">Home</Link></li>
            <li><Link href="/Clients" className="hover:text-gray-900 dark:hover:text-white transition-colors">Shop</Link></li>
            <li><Link href="/client-dashboard" className="hover:text-gray-900 dark:hover:text-white transition-colors">My Dashboard</Link></li>
            <li><Link href="/login" className="hover:text-gray-900 dark:hover:text-white transition-colors">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact</h3>
          <p className="text-sm mb-2">Have questions? Reach out to us.</p>
          <p className="text-sm">
            <a href="mailto:support@techninja.mu" className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
              support@techninja.mu
            </a>
          </p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-12 pt-8 border-t border-gray-200 dark:border-gray-800/50 text-sm text-center">
        &copy; {new Date().getFullYear()} Tech Ninja. All rights reserved.
      </div>
    </footer>
  );
}
