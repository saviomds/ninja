"use client";

import { useState } from "react";
import ContactModal from "./ContactModal";

export default function ContactFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Contact us"
        title="Contact us"
        className="fixed bottom-6 left-6 z-[90] group flex items-center gap-0 hover:gap-2 overflow-hidden w-12 hover:w-36 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-full shadow-lg shadow-blue-600/30 text-white font-semibold text-sm transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:rounded-2xl"
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-blue-500/40 animate-ping opacity-60 group-hover:opacity-0 transition-opacity" />

        {/* Icon */}
        <span className="relative z-10 flex-shrink-0 w-12 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </span>

        {/* Label (visible on hover expand) */}
        <span className="relative z-10 whitespace-nowrap pr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100">
          Contact Us
        </span>
      </button>

      {open && <ContactModal onClose={() => setOpen(false)} />}
    </>
  );
}
