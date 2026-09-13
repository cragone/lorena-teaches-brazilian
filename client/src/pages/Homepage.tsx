import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import rockInRio from "../assets/rock_in_rio.webp";
import graduation from "../assets/graduation.webp";
import fall from "../assets/fall_photo.webp";
import { fetchServices, formatPrice, type Service } from "../lib/api";

export default function HomePage() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const email = "lorenateachesbrazilian@yahoo.com";

  const [services, setServices] = useState<Service[]>([]);
  const [servicesError, setServicesError] = useState(false);

  useEffect(() => {
    fetchServices()
      .then((res) => setServices(res.services))
      .catch(() => setServicesError(true));
  }, []);

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
      {/* Brand bar */}
      <div className="h-1.5 bg-primary" />

      {/* Top bar */}
      <div className="navbar max-w-6xl mx-auto px-4">
        <div className="flex-1">
          <span className="btn btn-ghost text-base sm:text-xl font-bold px-2 whitespace-nowrap">
            Lorena <span className="font-normal">Interpreting</span>
          </span>
        </div>
        <div className="flex-none">
          <Link className="btn btn-primary btn-sm sm:btn-md" to="/book">
            Book a session
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-4 pb-6">
        <div className="card bg-base-100 shadow border border-base-300">
          <div className="card-body">
            <span className="badge badge-success badge-outline w-fit text-xs sm:text-sm whitespace-normal text-center">
              Portuguese ⇄ English • Live • Remote or in person
            </span>

            <h1 className="text-3xl md:text-4xl font-extrabold mt-2">
              Professional Portuguese interpreting from a{" "}
              <span className="text-primary">real Carioca</span>.
            </h1>

            <p className="text-base md:text-lg text-base-content/80 mt-2 max-w-3xl">
              Lorena interprets between Portuguese and English for medical
              appointments, legal matters, business calls, and everyday life —
              accurately, confidentially, and with the cultural context that
              machine translation misses.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="btn btn-primary" to="/book">
                Book a session
              </Link>
              <a className="btn btn-outline" href="#services">
                See services &amp; pricing
              </a>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="badge badge-accent badge-outline">
                Medical interpreting
              </div>
              <div className="badge badge-accent badge-outline">
                Legal interpreting
              </div>
              <div className="badge badge-accent badge-outline">
                Business &amp; general
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="max-w-6xl mx-auto px-4 pb-10">
        <div className="mb-4">
          <h2 className="text-3xl md:text-4xl font-extrabold">
            Interpreting services
          </h2>
          <p className="text-base-content/70 mt-1 max-w-3xl">
            Every session is one-on-one and scheduled around you. Pick the
            type of session below, or start with a free consultation if
            you&rsquo;re not sure what you need.
          </p>
        </div>

        {servicesError && (
          <div className="alert alert-warning mb-4">
            <span>
              Couldn&rsquo;t load live pricing right now — you can still{" "}
              <Link className="link" to="/book">
                start a booking
              </Link>{" "}
              or email Lorena directly.
            </span>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.id}
              className="card bg-base-100 shadow-xl border border-base-300"
            >
              <div className="card-body">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xl font-bold">{service.name}</div>
                  <div className="badge badge-primary badge-outline whitespace-nowrap">
                    {formatPrice(service.price_cents)}
                  </div>
                </div>
                <div className="text-sm text-base-content/70">
                  {service.description}
                </div>
                <div className="text-xs text-base-content/50 mt-1">
                  {service.duration_minutes} minutes
                </div>
                <div className="card-actions mt-3">
                  <Link
                    className="btn btn-sm btn-primary"
                    to={`/book?service=${service.slug}`}
                  >
                    Book this
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div
            className="alert bg-primary text-primary-content shadow border border-base-300"
            style={{ borderColor: "rgba(0,0,0,0)" }}
          >
            <span>
              Not sure which session fits? Start with a free 15-minute
              consultation.
            </span>
            <Link className="btn btn-sm btn-secondary" to="/book?service=consultation">
              Book the free call
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-4 pb-10">
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="text-2xl md:text-3xl font-extrabold mb-4">
              How booking works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="badge badge-primary mb-2">1</div>
                <div className="font-bold">Pick a service</div>
                <div className="text-sm text-base-content/70">
                  Choose the type of interpreting you need and the length of
                  session.
                </div>
              </div>
              <div>
                <div className="badge badge-primary mb-2">2</div>
                <div className="font-bold">Choose a time</div>
                <div className="text-sm text-base-content/70">
                  See Lorena&rsquo;s real availability and pick a slot that
                  works for you.
                </div>
              </div>
              <div>
                <div className="badge badge-primary mb-2">3</div>
                <div className="font-bold">Get confirmed</div>
                <div className="text-sm text-base-content/70">
                  Your request is held instantly and Lorena confirms the
                  details with you directly.
                </div>
              </div>
            </div>
            <div className="mt-6">
              <Link className="btn btn-primary" to="/book">
                Start booking
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="max-w-6xl mx-auto px-4 pb-10">
        <div className="mb-4">
          <h2 className="text-3xl md:text-4xl font-extrabold">
            About Lorena
          </h2>
          <p className="text-base-content/70 mt-1 max-w-3xl">
            Born and raised in Rio de Janeiro, Lorena interprets Portuguese
            and English with the fluency of a native Carioca and the
            precision the work demands — so nothing gets lost between
            languages.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
            <figure className="h-80 md:h-[28rem]">
              <img
                src={rockInRio}
                alt="Lorena in Rio de Janeiro"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </figure>
            <div className="card-body">
              <div className="text-xl font-bold">Native Carioca fluency</div>
              <div className="text-sm text-base-content/70">
                Not just textbook Portuguese — the language and cultural
                nuance of someone who actually grew up in Rio.
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
            <figure className="h-80 md:h-[28rem]">
              <img
                src={graduation}
                alt="Lorena's education background"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </figure>
            <div className="card-body">
              <div className="text-xl font-bold">Trained &amp; precise</div>
              <div className="text-sm text-base-content/70">
                Careful, accurate interpreting for conversations where
                getting it right actually matters.
              </div>
            </div>
          </div>

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
              <div className="text-xl font-bold">Calm under pressure</div>
              <div className="text-sm text-base-content/70">
                Friendly and easy to work with, even in stressful or
                sensitive conversations.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="max-w-6xl mx-auto px-4 pb-16">
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="text-2xl font-bold">Get in touch</h2>
            <p className="text-base-content/70">
              Ready to book, or have a question first? Reach out any time.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="btn btn-primary" to="/book">
                Book a session
              </Link>

              <a
                className="btn btn-outline"
                href={`mailto:${encodeURIComponent(
                  email,
                )}?subject=Interpreting%20Request&body=Hi%20Lorena%2C%0A%0AI%27d%20like%20to%20book%20an%20interpreting%20session.%0A%0AThanks!`}
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
          <p>© {year} Lorena • Portuguese ⇄ English Interpreting</p>
        </aside>
      </footer>
    </div>
  );
}
