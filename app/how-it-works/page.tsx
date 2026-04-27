import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Create an Account",
      desc: "Sign up quickly using our secure magic link system. No passwords to remember, just simple, instant access to your dashboard.",
    },
    {
      number: "02",
      title: "Manage Your Products",
      desc: "Add your items, set prices, and manage inventory. Our elegant dashboard makes it incredibly easy to showcase what you have to offer.",
    },
    {
      number: "03",
      title: "Connect Your Socials",
      desc: "Link your Instagram, Twitter, Website, and more. Give your visitors a centralized hub to find all your active platforms.",
    },
    {
      number: "04",
      title: "Post Updates",
      desc: "Keep your audience informed. Post quick snippets, system maintenance alerts, or exciting news directly to your platform feed.",
    }
  ];

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-20">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
            How Tech Ninja Works
          </h1>
          <p className="text-gray-400 text-lg">
            Your all-in-one platform for showcasing products, announcing updates, and connecting with your audience.
          </p>
        </div>

        <div className="space-y-8">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col md:flex-row items-start md:items-center gap-6 bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-8 hover:border-gray-700 transition-colors">
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-purple-600 opacity-80 shrink-0">
                {step.number}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <Link href="/login" className="inline-block bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-200 hover:scale-105 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            Start Building Now
          </Link>
        </div>
      </div>
    </main>
  );
}