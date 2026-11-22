"use client";

import { useState } from "react";

export default function TrustedByMarquee({ wordmarks }: { wordmarks: string[] }) {
  const [paused, setPaused] = useState(false);

  return (
    <section className="mb-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-7 px-6 py-10 sm:px-10 lg:py-12">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Trusted by ambitious teams worldwide
        </p>

        <div className={`trusted-marquee${paused ? " is-paused" : ""}`} aria-label="Trusted by teams and companies">
          <div className="trusted-marquee__viewport">
            <div className="trusted-marquee__track">
              {[false, true].map((isDuplicate) => (
                <ul
                  key={isDuplicate ? "duplicate" : "primary"}
                  className="trusted-marquee__group"
                  aria-hidden={isDuplicate}
                >
                  {wordmarks.map((name) => (
                    <li
                      key={name}
                      className="whitespace-nowrap text-[19px] font-semibold tracking-[-0.045em] text-neutral-400 transition-colors duration-200 hover:text-neutral-800 sm:text-[21px] font-mono"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
