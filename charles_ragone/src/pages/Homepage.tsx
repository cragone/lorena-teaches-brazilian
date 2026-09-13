import { useMemo } from "react";

const GITHUB_URL = "https://github.com/cragone";
const EMAIL = "ragonecharlie@gmail.com";
const RESUME_URL = "/charles-ragone-resume.pdf";

type FocusArea = {
  title: string;
  desc: string;
};

const focusAreas: FocusArea[] = [
  {
    title: "Insurance & benefits systems",
    desc: "Eligibility and benefits data for a union membership organization — snapshotting, validation, and reporting that has to be right.",
  },
  {
    title: "Pharma & regulated data",
    desc: "Automated reporting and document systems under HIPAA, FDA, and OSHA compliance requirements at a biotech.",
  },
  {
    title: "Data integration & EDI",
    desc: "SFTP ingestion pipelines, bulk validation, and structured logging for time-sensitive data syncing between systems.",
  },
  {
    title: "Payments & financial data",
    desc: "Transaction and financial data processing built with the same care as any system where numbers have to reconcile.",
  },
  {
    title: "IoT & device integration",
    desc: "Connecting hardware and devices to backend systems — provisioning, telemetry, and the plumbing in between.",
  },
  {
    title: "DevOps & infrastructure",
    desc: "Docker, Kubernetes (k3s), Traefik, and CI/CD on Azure and AWS — end-to-end ownership from the database to the deploy.",
  },
];

type Job = {
  role: string;
  org: string;
  location: string;
  period: string;
  bullets: string[];
};

const experience: Job[] = [
  {
    role: "Full Stack Developer",
    org: "UUP",
    location: "Latham, NY",
    period: "Aug 2024 – Present",
    bullets: [
      "Architected and maintained full-stack applications using Golang and PostgreSQL on Azure.",
      "Designed and implemented an eligibility snapshot system.",
      "Engineered SFTP ingestion pipelines with validation and bulk insertion.",
      "Built secure API authentication and authorization systems.",
      "Deployed services using Docker and k3s Kubernetes with Traefik Ingress.",
      "Developed cron services for time-sensitive data syncing with structured logging.",
      "Led Agile ceremonies including sprint planning, standups, and retrospectives.",
    ],
  },
  {
    role: "Data Specialist",
    org: "Regeneron",
    location: "Rensselaer, NY",
    period: "Dec 2020 – Aug 2024",
    bullets: [
      "Automated template-based reporting systems using Golang, Python-docx, MySQL, and React.",
      "Ensured HIPAA, FDA, and OSHA compliance in reporting workflows.",
      "Built a document storage system using Golang, React, PostgreSQL, Okta, and AWS S3.",
      "Conducted statistical analysis using JMP and Excel to support decision-making.",
    ],
  },
  {
    role: "Full Stack Web Developer",
    org: "Personal Projects",
    location: "Niskayuna, NY",
    period: "Dec 2019 – Present",
    bullets: [
      "Built a Division I cross-country fantasy app using Python scraping, a Golang backend, and PostgreSQL.",
      "Manage Kubernetes clusters hosting multiple production services, including this site.",
      "Built a Golang CLI tool for database migrations and deployment automation.",
      "Implemented a Go worker pool processing Azure OCR jobs asynchronously.",
      "Implemented Google and Okta authentication systems.",
      "Built and deployed production websites with Cloudflare TLS and GitHub Actions CI/CD.",
    ],
  },
];

const skillGroups: { title: string; items: string[] }[] = [
  { title: "Languages & frameworks", items: ["Go (Gin, GORM)", "Python", "React", "TypeScript/JavaScript", "Tailwind CSS", "DaisyUI"] },
  { title: "Data", items: ["PostgreSQL", "MySQL", "Raw SQL"] },
  {
    title: "Infrastructure & DevOps",
    items: ["Docker", "Kubernetes (k3s)", "Traefik Ingress", "Azure", "AWS", "Infrastructure as Code", "GitHub Actions CI/CD"],
  },
  { title: "Practices", items: ["Agile / Lean", "End-to-end system ownership", "Secure auth (Okta, Google)"] },
];

export default function HomePage() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <div className="h-1.5 bg-primary" />

      {/* Top bar */}
      <div className="navbar max-w-5xl mx-auto px-4">
        <div className="flex-1">
          <a href="#top" className="text-lg sm:text-xl font-bold whitespace-nowrap">
            Charles Ragone
          </a>
        </div>
        <div className="flex-none flex items-center gap-1 sm:gap-2">
          <a className="btn btn-ghost btn-sm hidden sm:inline-flex" href="#experience">
            Experience
          </a>
          <a className="btn btn-ghost btn-sm hidden sm:inline-flex" href="#skills">
            Skills
          </a>
          <a className="btn btn-ghost btn-sm hidden sm:inline-flex" href="#contact">
            Contact
          </a>
          <a
            className="btn btn-outline btn-sm"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>

      {/* Hero */}
      <section id="top" className="max-w-5xl mx-auto px-4 pt-6 pb-10">
        <div className="card bg-base-100 shadow border border-base-300">
          <div className="card-body">
            <span className="badge badge-accent badge-outline w-fit text-xs sm:text-sm">
              Full-stack development • DevOps & infrastructure
            </span>

            <h1 className="text-3xl md:text-5xl font-extrabold mt-3 leading-tight tracking-tight">
              I build and run production systems for{" "}
              <span className="text-primary">regulated, high-stakes industries</span>.
            </h1>

            <p className="text-base md:text-lg text-base-content/80 mt-3 max-w-2xl">
              Full-stack developer with a background in public health, working
              across insurance and benefits systems, pharma compliance, EDI
              and data integration, payments, and IoT device integration —
              with the Kubernetes and CI/CD pipelines to deploy and run all
              of it in production.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a className="btn btn-primary" href={RESUME_URL} target="_blank" rel="noopener noreferrer">
                Download resume
              </a>
              <a className="btn btn-outline" href="#experience">
                See experience
              </a>
              <a
                className="btn btn-ghost"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Focus areas */}
      <section id="focus" className="max-w-5xl mx-auto px-4 pb-12">
        <div className="mb-5">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Industries & systems I've worked in
          </h2>
          <p className="text-base-content/70 mt-1 max-w-2xl">
            Different domains, same approach: understand the data, own the
            system end to end, and ship something that holds up in
            production.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {focusAreas.map((area) => (
            <div
              key={area.title}
              className="card bg-base-100 border border-base-300 shadow-sm"
            >
              <div className="card-body p-5">
                <div className="font-bold">{area.title}</div>
                <div className="text-sm text-base-content/70">{area.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Experience */}
      <section id="experience" className="max-w-5xl mx-auto px-4 pb-12">
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Experience
            </h2>

            <div className="mt-4 space-y-6">
              {experience.map((job) => (
                <div
                  key={`${job.org}-${job.period}`}
                  className="border-l-2 border-primary/30 pl-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div className="font-bold text-lg">
                      {job.role} <span className="text-base-content/60 font-normal">— {job.org}</span>
                    </div>
                    <div className="text-sm text-base-content/60 whitespace-nowrap">
                      {job.period}
                    </div>
                  </div>
                  <div className="text-sm text-base-content/60">{job.location}</div>
                  <ul className="mt-2 space-y-1 text-sm text-base-content/80 list-disc list-inside">
                    {job.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Skills */}
      <section id="skills" className="max-w-5xl mx-auto px-4 pb-12">
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Skills
            </h2>

            <div className="grid sm:grid-cols-2 gap-6 mt-2">
              {skillGroups.map((group) => (
                <div key={group.title}>
                  <div className="font-semibold text-sm text-base-content/60 uppercase tracking-wide mb-2">
                    {group.title}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <span key={item} className="badge badge-outline badge-primary">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Education */}
      <section id="education" className="max-w-5xl mx-auto px-4 pb-12">
        <div className="card bg-base-100 shadow border border-base-300">
          <div className="card-body">
            <h2 className="text-xl font-bold tracking-tight">Background</h2>
            <p className="text-sm text-base-content/70 max-w-2xl">
              Came to software through public health and automation, not a
              CS degree — which is part of why I default to understanding
              the underlying data and process before writing code.
            </p>
            <ul className="mt-2 text-sm text-base-content/80 space-y-1">
              <li>
                <span className="font-semibold">
                  Masters Certificate, Fundamentals and Principles of Public Health
                </span>{" "}
                — SUNY at Albany, May 2024
              </li>
              <li>
                <span className="font-semibold">Bachelor of Science, Human Biology</span> —
                SUNY at Albany, May 2020
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="max-w-5xl mx-auto px-4 pb-16">
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="text-2xl font-bold tracking-tight">Get in touch</h2>
            <p className="text-base-content/70">
              Open to hearing about new projects and roles.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a className="btn btn-primary" href={`mailto:${EMAIL}`}>
                Email me
              </a>
              <a
                className="btn btn-outline"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <a className="btn btn-ghost" href={RESUME_URL} target="_blank" rel="noopener noreferrer">
                Download resume
              </a>
            </div>

            <div className="alert alert-info mt-4">
              <span>
                <code>{EMAIL}</code>
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer footer-center p-6 bg-base-300 text-base-content">
        <aside>
          <p>© {year} Charles Ragone</p>
        </aside>
      </footer>
    </div>
  );
}
