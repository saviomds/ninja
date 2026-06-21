import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase-server";

interface SocialProfile {
  id: string;
  platform_name: string;
  platform_icon: string;
  profile_link: string;
}

export default async function Footer() {
  const supabase = await createClient();
  const [{ data: socialsData }, { data: settingsData }] = await Promise.all([
    supabase
      .from("social_profiles")
      .select("id, platform_name, platform_icon, profile_link")
      .eq("is_active", true)
      .order("platform_name"),
    supabase.from("site_settings").select("key, value"),
  ]);

  const socials: SocialProfile[] = socialsData || [];

  const settings: Record<string, string> = Object.fromEntries(
    (settingsData || []).map((r) => [r.key, r.value])
  );
  const address  = settings.contact_address || "Port Louis, Mauritius";
  const phone    = settings.contact_phone   || "+230 5800 0000";
  const email    = settings.contact_email   || "hello@techninja.mu";
  const hours    = settings.contact_hours   || "Mon–Sat: 9am – 7pm";
  const tagline  = settings.brand_tagline   || "Premium electronics and smart gadgets for the modern lifestyle in Mauritius. Your tech, elevated.";

  const makeHref = (link: string) =>
    link.startsWith("http") ? link : `https://${link}`;

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
            <p className="text-[13px] leading-relaxed mb-5">{tagline}</p>
            {/* Social icons — dynamic from DB */}
            {socials.length > 0 && (
              <div className="flex items-center flex-wrap gap-2">
                {socials.map((p) => (
                  <a
                    key={p.id}
                    href={makeHref(p.profile_link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={p.platform_name}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-[#2563EB]/20 hover:text-[#2563EB] flex items-center justify-center transition-all overflow-hidden"
                  >
                    {p.platform_icon ? (
                      <Image
                        src={p.platform_icon}
                        alt={p.platform_name}
                        width={18}
                        height={18}
                        unoptimized
                        className="w-[18px] h-[18px] object-contain rounded"
                      />
                    ) : (
                      <span className="text-[11px] font-bold text-white/60">
                        {p.platform_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
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
                <span className="text-[13px]">{address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <span className="text-[13px]">{phone}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <a href={`mailto:${email}`} className="text-[13px] hover:text-white transition-colors">{email}</a>
              </li>
              <li className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[13px]">{hours}</span>
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
