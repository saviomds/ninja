import Link from "next/link";

export default function Footer() {
  return (
    <footer id="footer" className="bg-gray-950 text-gray-400 py-16 px-5 lg:px-8">
      <div className="max-w-7xl mx-auto">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[8px] bg-black flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-[16px] font-bold text-white">Tech<span className="text-[#2563EB]">Ninja</span></span>
            </Link>
            <p className="text-[13px] leading-relaxed mb-5">
              Premium electronics and smart gadgets for the modern lifestyle in Mauritius. Your tech, elevated.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3">
              {[
                { title: "X / Twitter", d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z", fill: true },
                { title: "Instagram",  d: "M7.5 2h9A5.5 5.5 0 0122 7.5v9A5.5 5.5 0 0116.5 22h-9A5.5 5.5 0 012 16.5v-9A5.5 5.5 0 017.5 2zm4.5 5a5 5 0 100 10A5 5 0 0012 7zm6.5-1a1 1 0 110 2 1 1 0 010-2z", fill: true },
                { title: "Facebook",   d: "M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z", fill: true },
              ].map(({ title, d, fill }) => (
                <a
                  key={title}
                  href="#"
                  title={title}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-[#2563EB]/20 hover:text-[#2563EB] flex items-center justify-center transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={2}>
                    <path d={d} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-[14px] font-semibold text-white mb-4">Shop</h4>
            <ul className="space-y-2.5">
              {[
                { href: "/Clients",      label: "All Products" },
                { href: "/repair",       label: "Repair Services" },
                { href: "/#deals",       label: "Deals & Offers" },
                { href: "/#categories",  label: "Categories" },
                { href: "/#featured",    label: "Featured Products" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-[13px] hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-[14px] font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2.5">
              {[
                { href: "/#services",  label: "About Tech Ninja" },
                { href: "/login",      label: "Sign In" },
                { href: "/profile",    label: "My Account" },
                { href: "/chat",       label: "Messages" },
                { href: "#",           label: "Privacy Policy" },
                { href: "#",           label: "Terms of Service" },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[14px] font-semibold text-white mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-[#2563EB] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="text-[13px]">Port Louis, Mauritius</span>
              </li>
              <li className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <span className="text-[13px]">+230 5800 0000</span>
              </li>
              <li className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <a href="mailto:hello@techninja.mu" className="text-[13px] hover:text-white transition-colors">
                  hello@techninja.mu
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[13px]">Mon–Sat: 9am – 7pm</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px]">© {new Date().getFullYear()} Tech Ninja. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="#" className="text-[12px] hover:text-white transition-colors">Privacy</Link>
            <span className="text-gray-700">·</span>
            <Link href="#" className="text-[12px] hover:text-white transition-colors">Terms</Link>
            <span className="text-gray-700">·</span>
            <Link href="#" className="text-[12px] hover:text-white transition-colors">Sitemap</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
