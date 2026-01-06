import rockInRio from "../assets/rock_in_rio.webp";
import graduation from "../assets/graduation.webp";
import fall from "../assets/fall_photo.webp";

export default function HomePage() {
  const year = new Date().getFullYear();
  const email = "erscied@gmail.com";

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      alert(`Copied: ${email}`);
    } catch {
      alert(`Email: ${email}`);
    }
  };

  const mailtoHref = `mailto:${encodeURIComponent(
    email,
  )}?subject=Biology%20%2F%20Chemistry%20Tutoring&body=Hi%20Eileen%2C%0A%0AI%20am%20interested%20in%20biology%20or%20chemistry%20tutoring.%0A%0AStudent%20grade%3A%20%0ASchool%2FClass%3A%20%0AWhat%20do%20you%20need%20help%20with%3F%20%0AUpcoming%20test%20date%20(if%20any)%3A%20%0A%0AThanks!`;

  return (
    <div className="min-h-screen text-base-content bg-base-200">
      {/* Background: subtle STEM vibe */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        {/* gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-base-200 via-base-200 to-base-300" />
        {/* soft accent glow */}
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-40 left-1/3 h-[420px] w-[420px] rounded-full bg-secondary/15 blur-3xl" />
        <div className="absolute top-72 right-1/4 h-[420px] w-[420px] rounded-full bg-accent/15 blur-3xl" />
        {/* faint grid */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-base-300/60 bg-base-200/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* simple mark */}
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow">
              <span className="text-primary-content font-extrabold">BC</span>
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-lg">Eileen Tutoring</div>
              <div className="text-xs text-base-content/60">
                Biology • Chemistry • Honors • AP
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <a className="btn btn-ghost btn-sm" href="#photos">
              Approach
            </a>
            <a className="btn btn-ghost btn-sm" href="#contact">
              Contact
            </a>
            <a className="btn btn-primary btn-sm" href="#contact">
              Email
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-8 pb-8">
        <div className="rounded-3xl border border-base-300/70 bg-base-100/70 backdrop-blur shadow-xl overflow-hidden">
          <div className="p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-outline border-primary/40 text-primary">
                Biology
              </span>
              <span className="badge badge-outline border-secondary/40 text-secondary">
                Chemistry
              </span>
              <span className="badge badge-outline border-accent/40 text-accent">
                Honors • AP
              </span>
              <span className="badge badge-outline">Online</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black mt-4 leading-tight">
              Bio & Chem{" "}
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                tutoring that actually clicks.
              </span>
            </h1>

            <p className="text-base md:text-lg text-base-content/75 mt-3 max-w-3xl">
              Step-by-step explanations, targeted practice, and smart test
              strategies. Catch up fast, boost grades, and feel confident on
              exams.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn btn-primary" href="#contact">
                Email for availability
              </a>
              <a className="btn btn-outline" href="#photos">
                See how lessons work
              </a>
            </div>

            <div className="mt-6 grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                <div className="font-bold">Concept clarity</div>
                <div className="text-sm text-base-content/70">
                  Understand the “why”, not just the steps.
                </div>
              </div>
              <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                <div className="font-bold">Exam practice</div>
                <div className="text-sm text-base-content/70">
                  Focused review + problem sets that match your class.
                </div>
              </div>
              <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                <div className="font-bold">Confidence</div>
                <div className="text-sm text-base-content/70">
                  Calm, supportive sessions where questions are welcome.
                </div>
              </div>
            </div>
          </div>

          {/* bottom accent line */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-accent" />
        </div>
      </section>

      {/* Photos / Features */}
      <section id="photos" className="max-w-6xl mx-auto px-4 pb-12">
        <div className="mb-6">
          <h2 className="text-3xl md:text-4xl font-black">
            A simple system that improves grades
          </h2>
          <p className="text-base-content/70 mt-2 max-w-3xl">
            Tutoring is most effective when it’s structured, focused, and
            tailored to the student. Each session follows a clear process so
            students know exactly what they’re learning and why it matters.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-xl">
            <div className="text-xl font-black">1. Identify gaps</div>
            <p className="text-sm text-base-content/70 mt-2">
              We start by pinpointing weak spots—whether it’s foundational
              concepts, problem setup, or test-taking strategy.
            </p>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-xl">
            <div className="text-xl font-black">2. Build understanding</div>
            <p className="text-sm text-base-content/70 mt-2">
              Concepts are explained step by step, with clear examples and
              analogies until everything clicks.
            </p>
          </div>

          <div className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-xl">
            <div className="text-xl font-black">3. Practice with purpose</div>
            <p className="text-sm text-base-content/70 mt-2">
              Targeted problems reinforce learning and build confidence for
              quizzes, exams, and AP-style questions.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-base-300 bg-gradient-to-r from-primary/15 via-secondary/15 to-accent/15 p-5 shadow">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="font-semibold">
              Have an upcoming test or need help catching up?
            </span>
            <a className="btn btn-secondary btn-sm" href="#contact">
              Email to get started
            </a>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-3xl border border-base-300 bg-base-100/70 backdrop-blur shadow-xl">
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-black">Contact</h2>
            <p className="text-base-content/70 mt-1">
              Email to ask questions, check availability, or request a session.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a className="btn btn-primary" href={mailtoHref}>
                Email
              </a>

              <button className="btn btn-outline" onClick={copyEmail}>
                Copy email
              </button>
            </div>

            <div className="alert alert-info mt-4">
              <span>
                <code>{email}</code>
              </span>
            </div>

            <div className="alert alert-success mt-3">
              <span>📬 Replies usually within 24 hours</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer footer-center p-6 bg-base-300">
        <aside>
          <p>© {year} Eileen • Biology & Chemistry Tutoring</p>
        </aside>
      </footer>
    </div>
  );
}
