import { useMemo } from "react";
import rockInRio from "../assets/rock_in_rio.webp";
import graduation from "../assets/graduation.webp";
import fall from "../assets/fall_photo.webp";

export default function HomePage() {
  const year = useMemo(() => new Date().getFullYear(), []);

  const email = "lorenateachesbrazilian@yahoo.com";
  const calendlyUrl = "https://calendly.com/lorenateachesbrazilian/30min";

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      alert(`Copied: ${email}`);
    } catch {
      alert(`Email: ${email}`);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      {/* Brazil vibe stripe */}
      <div className="w-full">
        <div className="h-2 bg-primary" />
        <div className="h-2 bg-secondary" />
        <div className="h-2 bg-accent" />
      </div>

      {/* Top bar */}
      <div className="navbar max-w-6xl mx-auto px-4">
        <div className="flex-1">
          <span className="btn btn-ghost text-xl font-bold">Lorena 🇧🇷</span>
        </div>
        <div className="flex-none">
          <a className="btn btn-primary" href="#schedule">
            Book
          </a>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-4 pb-6">
        <div className="card bg-base-100 shadow border border-base-300">
          <div className="card-body">
            <span className="badge badge-success badge-outline w-fit text-xs sm:text-sm whitespace-normal text-center">
              Brazilian Portuguese • Online • Real conversation
            </span>

            <h1 className="text-3xl md:text-4xl font-extrabold mt-2">
              Practice with a <span className="text-primary">real Carioca</span>{" "}
              and learn how Brazilians actually speak.
            </h1>

            <p className="text-base md:text-lg text-base-content/80 mt-2 max-w-3xl">
              The focus is conversation — pronunciation, confidence, and the
              words you’ll hear in Brazil. Travel, relationships, or starting
              from zero.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a className="btn btn-primary" href="#photos">
                See the vibes
              </a>
              <a className="btn btn-outline" href="#contact">
                Book a lesson
              </a>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="badge badge-accent badge-outline">
                Talk like locals
              </div>
              <div className="badge badge-accent badge-outline">
                Real pronunciation
              </div>
              <div className="badge badge-accent badge-outline">
                Confidence fast
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Photos */}
      <section id="photos" className="max-w-6xl mx-auto px-4 pb-10">
        <div className="mb-4">
          <h2 className="text-3xl md:text-4xl font-extrabold">
            Conversation-first Portuguese 🇧🇷
          </h2>
          <p className="text-base-content/70 mt-1 max-w-3xl">
            Learn how to <b>converse with Brazilians</b> — greetings, slang,
            flirting, ordering food, making friends, and feeling natural in
            Brazil. Lorena is a <b>real Carioca</b>, so you’ll practice the way
            people actually talk.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* BIG FEATURE CARD */}
          <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
            <figure className="h-80  md:h-[28rem]">
              <img
                src={rockInRio}
                alt="Brazil beach vibes"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </figure>
            <div className="card-body">
              <div className="text-2xl font-bold">
                Learn Portuguese for real life
              </div>
              <div className="text-base-content/80">
                Speak with confidence at the beach, bars, cafés, and everywhere
                Brazilians hang out. You’ll learn phrases you can actually use.
              </div>
            </div>
          </div>

          {/* SIDE CARD 1 */}
          <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
            <figure className="h-80 md:h-[28rem]">
              <img
                src={graduation}
                alt="Lorena outdoors"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </figure>
            <div className="card-body">
              <div className="text-xl font-bold">Talk with a real Carioca</div>
              <div className="text-sm text-base-content/70">
                Get corrected naturally, learn pronunciation, and pick up how
                people speak in Rio.
              </div>
            </div>
          </div>

          {/* SIDE CARD 2 */}
          <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
            <figure className="h-80 md:h-[28rem]">
              <img
                src={fall}
                alt="Lorena smiling"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </figure>
            <div className="card-body">
              <div className="text-xl font-bold">
                Friendly + personal lessons
              </div>
              <div className="text-sm text-base-content/70">
                Relaxed vibe, clear explanations, and a plan that fits your
                goal.
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div
              className="alert bg-primary text-primary-content shadow border border-base-300"
              style={{ borderColor: "rgba(0,0,0,0)" }}
            >
              <span>
                Want to sound natural fast? Book a lesson and start practicing
                today.
              </span>
              <a className="btn btn-sm btn-secondary" href="#contact">
                Book now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule */}
      <section id="schedule" className="max-w-6xl mx-auto px-4 pb-16">
        <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
          <div className="card-body">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left: Copy + trust */}
              <div className="lg:w-[38%]">
                <h2 className="text-3xl font-extrabold">
                  Book your <span className="text-primary">60-minute</span>{" "}
                  lesson
                </h2>

                <p className="text-base-content/70 mt-2">
                  Pick a time that works for you — you’ll get a confirmation
                  email and everything is automatic.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="badge badge-accent badge-outline">Online</div>
                  <div className="badge badge-accent badge-outline">
                    Conversation-first
                  </div>
                  <div className="badge badge-accent badge-outline">
                    Pronunciation help
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="alert alert-success">
                    <span>✅ Fast scheduling — no back and forth</span>
                  </div>
                  <div className="alert alert-info">
                    <span>📩 You’ll receive the link + details by email</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    className="btn btn-primary"
                    href={calendlyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Calendly
                  </a>

                  <a className="btn btn-outline" href="#contact">
                    Prefer email?
                  </a>
                </div>

                <p className="text-xs text-base-content/50 mt-3">
                  If the embed doesn’t load (rare), use “Open Calendly”.
                </p>
              </div>

              {/* Right: Embedded Calendly */}
              <div className="lg:flex-1">
                <div className="rounded-2xl border border-base-300 overflow-hidden bg-base-200">
                  <div className="p-3 border-b border-base-300 flex items-center justify-between">
                    <div className="font-semibold">Choose a time</div>
                    <a
                      href={calendlyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary text-sm"
                    >
                      Open in new tab
                    </a>
                  </div>

                  <div className="w-full h-[720px] md:h-[760px]">
                    <iframe
                      title="Schedule with Lorena"
                      src={`${calendlyUrl}?hide_gdpr_banner=1`}
                      className="w-full h-full"
                      frameBorder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="max-w-6xl mx-auto px-4 pb-16">
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="text-2xl font-bold">Book a lesson</h2>
            <p className="text-base-content/70">Click to email Lorena.</p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                className="btn btn-primary"
                href={`mailto:${encodeURIComponent(
                  email,
                )}?subject=Portuguese%20Lesson%20Request&body=Hi%20Lorena%2C%0A%0AI%20want%20to%20book%20a%20Portuguese%20lesson.%0A%0AThanks!`}
              >
                Email Lorena
              </a>

              <button
                className="btn btn-outline"
                onClick={copyEmail}
                type="button"
              >
                Copy email
              </button>
            </div>

            <div className="alert alert-info mt-4">
              <span>
                <code>{email}</code>
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer footer-center p-6 bg-base-300 text-base-content">
        <aside>
          <p>© {year} Lorena • Brazilian Portuguese Tutoring</p>
        </aside>
      </footer>
    </div>
  );
}
