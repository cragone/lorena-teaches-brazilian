import { useMemo, useState } from "react";
import cake_1 from "../assets/cake_1.webp";
import cake_2 from "../assets/cake_2.webp";
import cake_3 from "../assets/cake_3.webp";
import cake_4 from "../assets/cake_4.webp";

type Lang = "pt" | "en";

export default function HomePage() {
  const year = useMemo(() => new Date().getFullYear(), []);

  // Business contact / ordering
  const email = "orders@conceicaoconfefetteria.com"; // TODO: replace with real
  const phone = "(518) 000-0000"; // optional display (US format)
  const instagramHandle = "kledna_conceicao";
  const instagramUrl = `https://instagram.com/${instagramHandle}`;
  const whatsappE164 = "+15180000000"; // TODO: replace with real WhatsApp number (E.164 format, ex: +15551234567)

  const [lang, setLang] = useState<Lang>("pt");

  // Simple “Instagram-style” gallery modal
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const t = {
    pt: {
      brand: "Conceição Confeitaria 🍰",
      navGallery: "Galeria",
      navOrder: "Orçamento",
      navContact: "Contato",
      badge: "Bolos sob encomenda • Cupcakes • Mesas de doces • Eventos",
      heroTitle: (
        <>
          Bolos personalizados para{" "}
          <span className="text-primary">casamentos, aniversários</span> e
          momentos inesquecíveis.
        </>
      ),
      heroDesc:
        "Sabor marcante, design elegante e aquele toque caseiro feito com carinho — para impressionar e encantar.",
      ctaQuote: "Pedir orçamento",
      ctaSee: "Ver galeria",
      ctaHow: "Como funciona →",
      featuredTitle: "Bolo em destaque",
      featuredDesc: "Um exemplo do nosso acabamento e estilo.",
      featuredCta: "Quero esse estilo",
      sectionGalleryTitle: "Bolos que são pura poesia 💐",
      sectionGalleryDesc:
        "Escolha o estilo, defina os sabores e a gente cria algo inesquecível para o seu evento.",
      galleryCta: "Pedir orçamento",
      howTitle: "Como funciona",
      howDesc: "Simples, rápido e pensado para o seu evento.",
      how1Title: "1) Envie os detalhes",
      how1Desc:
        "Data, número de porções, tema/cores, sabores e fotos de inspiração.",
      how2Title: "2) Receba o orçamento",
      how2Desc: "Confirmamos disponibilidade + valores e tiramos suas dúvidas.",
      how3Title: "3) Retirada ou entrega",
      how3Desc: "Fechamos o design e seu bolo fica pronto para o grande dia.",
      orderTitle: (
        <>
          Solicite um <span className="text-primary">orçamento</span>
        </>
      ),
      orderDesc:
        "Use o formulário e responderemos por e-mail com disponibilidade + preço.",
      tip: "Dica: envie fotos de inspiração para agilizar o orçamento.",
      emailPrefilled: "E-mail (pré-preenchido)",
      contactInfo: "Informações de contato",
      formTitle: "Formulário de pedido",
      formDesc: "",
      yourName: "Seu nome",
      emailLabel: "E-mail",
      eventDate: "Data do evento",
      servings: "Porções",
      type: "Tipo",
      pickupDelivery: "Retirada ou entrega",
      allergies: "Alergias (opcional)",
      flavorsTheme: "Sabores / tema",
      notes: "Observações / inspiração",
      submit: "Enviar pedido 🍰",
      orEmail: "Ou envie direto:",
      types: {
        cake: "Bolo personalizado",
        cupcakes: "Cupcakes",
        dessertTable: "Mesa de doces",
      },
      options: {
        pickup: "Retirada",
        delivery: "Entrega",
      },
      contactTitle: "Contato + pedidos",
      contactDesc:
        "Envie a data do evento, porções, tema/cores e inspirações para um orçamento rápido.",
      emailToOrder: "Enviar e-mail",
      copyEmail: "Copiar e-mail",
      whatsapp: "WhatsApp",
      instagram: "Instagram",
      faq: "Perguntas frequentes",
      faq1Q: "Com quanta antecedência devo pedir?",
      faq1A: "Idealmente 1–2 semanas (mais para casamentos e eventos grandes).",
      faq2Q: "Vocês fazem entrega?",
      faq2A: "Sim — inclua o endereço no pedido para confirmarmos a taxa/rota.",
      faq3Q: "Consegue combinar com um tema?",
      faq3A: "Sim! Envie cores/fotos e a gente cria no seu estilo.",
      startOrder: "Começar meu pedido",
      modalHint: "Use as setas para navegar • ESC para fechar",
      footer: `© ${year} Conceição Confeitaria • Bolos & Doces`,
      quickTipTitle: "Dica rápida",
      quickTipDesc:
        "Compartilhe data, porções, tema/cores e fotos de inspiração — respondemos com disponibilidade + valores.",
      alertLine:
        "Pronta(o) para pedir? Envie a data + porções — a gente responde com um orçamento.",
    },
    en: {
      brand: "Conceição Confefetteria 🍰",
      navGallery: "Gallery",
      navOrder: "Order / Quote",
      navContact: "Contact",
      badge: "Custom cakes • Cupcakes • Dessert tables • Events",
      heroTitle: (
        <>
          Custom cakes for{" "}
          <span className="text-primary">weddings, birthdays</span> & every
          sweet moment.
        </>
      ),
      heroDesc:
        "Bold flavor, elegant design, and a homemade feel — made to impress and delight.",
      ctaQuote: "Get a quote",
      ctaSee: "View gallery",
      ctaHow: "How it works →",
      featuredTitle: "Featured cake",
      featuredDesc: "A look at our finish and style.",
      featuredCta: "I want this style",
      sectionGalleryTitle: "Cakes that feel like poetry 💐",
      sectionGalleryDesc:
        "Pick your style, choose your flavors, and we’ll create something unforgettable.",
      galleryCta: "Get a quote",
      howTitle: "How it works",
      howDesc: "Simple, fast, and designed around your event.",
      how1Title: "1) Send details",
      how1Desc:
        "Date, servings, theme/colors, flavors, and inspiration photos.",
      how2Title: "2) Get a quote",
      how2Desc: "We confirm availability + pricing and answer questions.",
      how3Title: "3) Pickup or delivery",
      how3Desc:
        "We finalize the design and your cake is ready for the big day.",
      orderTitle: (
        <>
          Request a <span className="text-primary">quote</span>
        </>
      ),
      orderDesc:
        "Use the form and we’ll reply by email with availability + pricing.",
      tip: "Tip: attach inspiration photos for the fastest quote.",
      emailPrefilled: "Email (prefilled)",
      contactInfo: "Contact info",
      formTitle: "Cake request form",
      formDesc: "",
      yourName: "Your name",
      emailLabel: "Email",
      eventDate: "Event date",
      servings: "Servings",
      type: "Type",
      pickupDelivery: "Pickup or delivery",
      allergies: "Allergies (optional)",
      flavorsTheme: "Flavors / theme",
      notes: "Notes / inspiration",
      submit: "Request quote 🍰",
      orEmail: "Or email directly:",
      types: {
        cake: "Custom cake",
        cupcakes: "Cupcakes",
        dessertTable: "Dessert table",
      },
      options: {
        pickup: "Pickup",
        delivery: "Delivery",
      },
      contactTitle: "Contact + ordering",
      contactDesc:
        "Send event date, servings, theme/colors, and inspiration for a quick quote.",
      emailToOrder: "Email to order",
      copyEmail: "Copy email",
      whatsapp: "WhatsApp",
      instagram: "Instagram",
      faq: "FAQ",
      faq1Q: "How far in advance should I order?",
      faq1A: "Ideally 1–2 weeks (more for weddings and large events).",
      faq2Q: "Do you do delivery?",
      faq2A: "Yes — include your address and we’ll confirm delivery details.",
      faq3Q: "Can you match a theme?",
      faq3A: "Absolutely — send photos/colors and we’ll match the vibe.",
      startOrder: "Start my order",
      modalHint: "Use arrows to navigate • ESC to close",
      footer: `© ${year} Conceição Confefetteria • Cakes & Desserts`,
      quickTipTitle: "Quick tip",
      quickTipDesc:
        "Share date, servings, theme/colors, and inspiration photos — we’ll reply with availability + pricing.",
      alertLine:
        "Ready to order? Send your date + servings — we’ll reply with a quote.",
    },
  } as const;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      alert(lang === "pt" ? `Copiado: ${email}` : `Copied: ${email}`);
    } catch {
      alert(`${lang === "pt" ? "E-mail" : "Email"}: ${email}`);
    }
  };

  const mailtoHref = `mailto:${encodeURIComponent(
    email,
  )}?subject=${encodeURIComponent(
    lang === "pt" ? "Pedido de Bolo Personalizado" : "Custom Cake Request",
  )}&body=${encodeURIComponent(
    lang === "pt"
      ? `Olá Conceição Confeitaria!

Data do evento:
Retirada ou entrega:
Porções:
Tipo (bolo/cupcakes/mesa de doces):
Tema/cores:
Sabores:
Alergias (se houver):
Links/fotos de inspiração:

Obrigada(o)!`
      : `Hi Conceição Confefetteria!

Event date:
Pickup or delivery:
Servings:
Type (cake/cupcakes/dessert table):
Theme/colors:
Flavors:
Allergies (if any):
Inspiration links/photos:

Thank you!`,
  )}`;

  const whatsappHref = `https://wa.me/${whatsappE164.replace(
    /\D/g,
    "",
  )}?text=${encodeURIComponent(
    lang === "pt"
      ? `Olá! Gostaria de um orçamento 😊\n\nData do evento:\nPorções:\nTipo (bolo/cupcakes/mesa de doces):\nTema/cores:\nSabores:\nRetirada ou entrega:\n`
      : `Hi! I’d like a quote 😊\n\nEvent date:\nServings:\nType (cake/cupcakes/dessert table):\nTheme/colors:\nFlavors:\nPickup or delivery:\n`,
  )}`;

  const gallery = [
    {
      src: cake_1,
      titlePT: "Bolos de celebração",
      titleEN: "Signature celebration cakes",
      descPT: "Designs sob medida, com acabamento elegante e muito sabor.",
      descEN: "Custom designs with an elegant finish — and even better flavor.",
    },
    {
      src: cake_2,
      titlePT: "Cupcakes + docinhos",
      titleEN: "Cupcakes + bite-sized sweets",
      descPT:
        "Perfeitos para festas, chá de bebê e eventos — fáceis de servir.",
      descEN: "Perfect for showers and events — easy to serve and share.",
    },
    {
      src: cake_3,
      titlePT: "Bolos para eventos",
      titleEN: "Elegant event cakes",
      descPT: "Estilo clean e moderno para casamentos e grandes momentos.",
      descEN: "Clean, modern finishes for weddings and milestones.",
    },
    {
      src: cake_4,
      titlePT: "Mesas de doces",
      titleEN: "Dessert tables",
      descPT: "Um conjunto completo: bolo + doces combinando com seu tema.",
      descEN: "A full spread: cake + matching sweets for your theme.",
    },
  ];

  const openModal = (idx: number) => setActiveIndex(idx);
  const closeModal = () => setActiveIndex(null);

  const prev = () => {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex - 1 + gallery.length) % gallery.length);
  };

  const next = () => {
    if (activeIndex === null) return;
    setActiveIndex((activeIndex + 1) % gallery.length);
  };

  // Keyboard controls for modal
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (activeIndex === null) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  };

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      {/* Top bar */}
      <div className="navbar max-w-6xl mx-auto px-4">
        <div className="flex-1">
          <a
            href="#top"
            className="text-xl md:text-2xl font-extrabold tracking-tight"
          >
            {t[lang].brand}
          </a>
        </div>

        <div className="flex-none flex items-center gap-2">
          {/* Language toggle */}
          <div className="join join-horizontal border border-base-300 rounded-full">
            <button
              className={`btn btn-sm join-item ${
                lang === "pt" ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => setLang("pt")}
              type="button"
            >
              PT
            </button>
            <button
              className={`btn btn-sm join-item ${
                lang === "en" ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => setLang("en")}
              type="button"
            >
              EN
            </button>
          </div>

          <a className="btn btn-ghost" href="#gallery">
            {t[lang].navGallery}
          </a>
          <a className="btn btn-primary" href="#order">
            {t[lang].navOrder}
          </a>
        </div>
      </div>

      {/* Hero */}
      <section id="top" className="max-w-6xl mx-auto px-4 pt-4 pb-10">
        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
          <div className="card bg-base-100 shadow-xl border border-base-300">
            <div className="card-body">
              <span className="badge badge-success badge-outline w-fit text-xs sm:text-sm whitespace-normal text-center">
                {t[lang].badge}
              </span>

              <h1 className="text-3xl md:text-5xl font-extrabold mt-3 leading-tight tracking-tight">
                {t[lang].heroTitle}
              </h1>

              <p className="text-base md:text-lg text-base-content/80 mt-3 max-w-xl">
                {t[lang].heroDesc}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a className="btn btn-primary" href="#order">
                  {t[lang].ctaQuote}
                </a>
                <a className="btn btn-outline" href="#gallery">
                  {t[lang].ctaSee}
                </a>
                <a className="btn btn-ghost" href="#how">
                  {t[lang].ctaHow}
                </a>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="badge badge-accent badge-outline">
                  {lang === "pt" ? "Design exclusivo" : "Custom design"}
                </div>
                <div className="badge badge-accent badge-outline">
                  {lang === "pt" ? "Ingredientes frescos" : "Fresh ingredients"}
                </div>
                <div className="badge badge-accent badge-outline">
                  {lang === "pt" ? "Pronto para eventos" : "Event-ready"}
                </div>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-base-200 border border-base-300">
                <div className="font-semibold">{t[lang].quickTipTitle}</div>
                <p className="text-sm text-base-content/70 mt-1">
                  {t[lang].quickTipDesc}
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
            <figure className="h-80 lg:h-full">
              <img
                src={cake_1}
                alt={lang === "pt" ? "Bolo personalizado" : "Custom cake"}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </figure>
            <div className="card-body">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-bold">
                    {t[lang].featuredTitle}
                  </div>
                  <div className="text-sm text-base-content/70">
                    {t[lang].featuredDesc}
                  </div>
                </div>
                <a className="btn btn-sm btn-secondary" href="#order">
                  {t[lang].featuredCta}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="max-w-6xl mx-auto px-4 pb-14">
        <div className="mb-5">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {t[lang].sectionGalleryTitle}
          </h2>
          <p className="text-base-content/70 mt-1 max-w-3xl">
            {t[lang].sectionGalleryDesc}
          </p>
        </div>

        {/* Instagram-style grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {gallery.map((g, idx) => (
            <button
              key={idx}
              type="button"
              className="group relative aspect-square overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-xl"
              onClick={() => openModal(idx)}
              aria-label={lang === "pt" ? g.titlePT : g.titleEN}
            >
              <img
                src={g.src}
                alt={lang === "pt" ? g.titlePT : g.titleEN}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-left">
                <div className="text-primary-content font-semibold text-sm">
                  {lang === "pt" ? g.titlePT : g.titleEN}
                </div>
                <div className="text-primary-content/80 text-xs mt-0.5 line-clamp-2">
                  {lang === "pt" ? g.descPT : g.descEN}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <div
            className="alert bg-primary text-primary-content shadow border border-base-300"
            style={{ borderColor: "rgba(0,0,0,0)" }}
          >
            <span>{t[lang].alertLine}</span>
            <a className="btn btn-sm btn-secondary" href="#order">
              {t[lang].galleryCta}
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-4 pb-14">
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="text-3xl font-extrabold tracking-tight">
              {t[lang].howTitle}
            </h2>
            <p className="text-base-content/70">{t[lang].howDesc}</p>

            <div className="grid lg:grid-cols-3 gap-4 mt-6">
              <div className="p-5 rounded-2xl border border-base-300 bg-base-200">
                <div className="font-bold text-lg">{t[lang].how1Title}</div>
                <p className="text-sm text-base-content/70 mt-1">
                  {t[lang].how1Desc}
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-base-300 bg-base-200">
                <div className="font-bold text-lg">{t[lang].how2Title}</div>
                <p className="text-sm text-base-content/70 mt-1">
                  {t[lang].how2Desc}
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-base-300 bg-base-200">
                <div className="font-bold text-lg">{t[lang].how3Title}</div>
                <p className="text-sm text-base-content/70 mt-1">
                  {t[lang].how3Desc}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn btn-primary" href="#order">
                {t[lang].ctaQuote}
              </a>
              <a className="btn btn-ghost" href="#contact">
                {t[lang].navContact}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Order */}
      <section id="order" className="max-w-6xl mx-auto px-4 pb-16">
        <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
          <div className="card-body">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left */}
              <div className="lg:w-[38%]">
                <h2 className="text-3xl font-extrabold tracking-tight">
                  {t[lang].orderTitle}
                </h2>

                <p className="text-base-content/70 mt-2">{t[lang].orderDesc}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="badge badge-accent badge-outline">
                    {lang === "pt" ? "Bolos" : "Cakes"}
                  </div>
                  <div className="badge badge-accent badge-outline">
                    {lang === "pt" ? "Cupcakes" : "Cupcakes"}
                  </div>
                  <div className="badge badge-accent badge-outline">
                    {lang === "pt" ? "Mesa de doces" : "Dessert tables"}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="alert alert-success">
                    <span>
                      ✅{" "}
                      {lang === "pt"
                        ? "Resposta rápida e pedido simples"
                        : "Fast replies — simple ordering"}
                    </span>
                  </div>
                  <div className="alert alert-info">
                    <span>
                      📩{" "}
                      {lang === "pt"
                        ? "Orçamentos por e-mail"
                        : "Quotes sent by email"}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a className="btn btn-primary" href={mailtoHref}>
                    {t[lang].emailPrefilled}
                  </a>
                  <a
                    className="btn btn-secondary"
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t[lang].whatsapp}
                  </a>
                  <a className="btn btn-ghost" href="#contact">
                    {t[lang].contactInfo}
                  </a>
                </div>

                <p className="mt-4 text-sm text-base-content/60">
                  {t[lang].tip}
                </p>
              </div>

              {/* Right: Cake Request Form */}
              <div className="lg:flex-1">
                <div className="rounded-2xl border border-base-300 bg-base-100 shadow-xl">
                  <div className="p-4 border-b border-base-300">
                    <div className="font-semibold text-lg">
                      {t[lang].formTitle}
                    </div>
                    <p className="text-sm text-base-content/60">
                      {t[lang].formDesc}
                    </p>
                  </div>

                  <form
                    className="p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      alert(
                        lang === "pt"
                          ? "Pedido recebido! Vamos te responder por e-mail 🍰"
                          : "Request received! We'll email you shortly 🍰",
                      );
                    }}
                  >
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">
                          <span className="label-text">{t[lang].yourName}</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={lang === "pt" ? "Seu nome" : "Jane Doe"}
                          className="input input-bordered w-full"
                        />
                      </div>

                      <div>
                        <label className="label">
                          <span className="label-text">
                            {t[lang].emailLabel}
                          </span>
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="you@email.com"
                          className="input input-bordered w-full"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="label">
                          <span className="label-text">
                            {t[lang].eventDate}
                          </span>
                        </label>
                        <input
                          type="date"
                          required
                          className="input input-bordered w-full"
                        />
                      </div>

                      <div>
                        <label className="label">
                          <span className="label-text">{t[lang].servings}</span>
                        </label>
                        <input
                          type="number"
                          min="6"
                          placeholder="20"
                          className="input input-bordered w-full"
                        />
                      </div>

                      <div>
                        <label className="label">
                          <span className="label-text">{t[lang].type}</span>
                        </label>
                        <select className="select select-bordered w-full">
                          <option>{t[lang].types.cake}</option>
                          <option>{t[lang].types.cupcakes}</option>
                          <option>{t[lang].types.dessertTable}</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">
                          <span className="label-text">
                            {t[lang].pickupDelivery}
                          </span>
                        </label>
                        <select className="select select-bordered w-full">
                          <option>{t[lang].options.pickup}</option>
                          <option>{t[lang].options.delivery}</option>
                        </select>
                      </div>

                      <div>
                        <label className="label">
                          <span className="label-text">
                            {t[lang].allergies}
                          </span>
                        </label>
                        <input
                          type="text"
                          placeholder={
                            lang === "pt"
                              ? "Nozes, glúten, lactose…"
                              : "Nuts, gluten, dairy…"
                          }
                          className="input input-bordered w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">
                        <span className="label-text">
                          {t[lang].flavorsTheme}
                        </span>
                      </label>
                      <input
                        type="text"
                        placeholder={
                          lang === "pt"
                            ? "Chocolate, baunilha, morango, tema rosé…"
                            : "Chocolate, vanilla, strawberry, blush theme…"
                        }
                        className="input input-bordered w-full"
                      />
                    </div>

                    <div>
                      <label className="label">
                        <span className="label-text">{t[lang].notes}</span>
                      </label>
                      <textarea
                        rows={4}
                        placeholder={
                          lang === "pt"
                            ? "Conte sobre seu evento + cole links de inspiração."
                            : "Tell us about your event + paste inspiration links."
                        }
                        className="textarea textarea-bordered w-full"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button type="submit" className="btn btn-primary">
                        {t[lang].submit}
                      </button>
                    </div>

                    <div className="pt-2">
                      <div className="text-xs text-base-content/60">
                        {t[lang].orEmail}{" "}
                        <a className="link" href={mailtoHref}>
                          {email}
                        </a>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card bg-base-100 shadow-xl border border-base-300">
            <div className="card-body">
              <h2 className="text-2xl font-bold tracking-tight">
                {t[lang].contactTitle}
              </h2>
              <p className="text-base-content/70">{t[lang].contactDesc}</p>

              <div className="mt-4 flex flex-wrap gap-3">
                <a className="btn btn-primary" href={mailtoHref}>
                  {t[lang].emailToOrder}
                </a>
                <button
                  className="btn btn-outline"
                  onClick={copyEmail}
                  type="button"
                >
                  {t[lang].copyEmail}
                </button>

                <a
                  className="btn btn-secondary"
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t[lang].whatsapp}
                </a>

                <a
                  className="btn btn-ghost"
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t[lang].instagram} @{instagramHandle}
                </a>
              </div>

              <div className="alert alert-info mt-4">
                <span>
                  <code>{email}</code>
                  {phone ? <span className="ml-3">• {phone}</span> : null}
                </span>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl border border-base-300">
            <div className="card-body">
              <h3 className="text-xl font-bold tracking-tight">
                {t[lang].faq}
              </h3>
              <div className="space-y-3 text-sm text-base-content/70">
                <div>
                  <div className="font-semibold text-base-content">
                    {t[lang].faq1Q}
                  </div>
                  <div>{t[lang].faq1A}</div>
                </div>
                <div>
                  <div className="font-semibold text-base-content">
                    {t[lang].faq2Q}
                  </div>
                  <div>{t[lang].faq2A}</div>
                </div>
                <div>
                  <div className="font-semibold text-base-content">
                    {t[lang].faq3Q}
                  </div>
                  <div>{t[lang].faq3A}</div>
                </div>
              </div>

              <div className="mt-4">
                <a className="btn btn-secondary w-full" href="#order">
                  {t[lang].startOrder}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer footer-center p-6 bg-base-300 text-base-content">
        <aside>
          <p>{t[lang].footer}</p>
        </aside>
      </footer>

      {/* Instagram-style Modal */}
      {activeIndex !== null && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          onKeyDown={onKeyDown}
          tabIndex={-1}
        >
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={closeModal}
            aria-label={lang === "pt" ? "Fechar" : "Close"}
          />

          {/* Modal content */}
          <div className="relative max-w-5xl mx-auto h-full flex items-center justify-center p-4">
            <div className="w-full bg-base-100 border border-base-300 rounded-3xl shadow-2xl overflow-hidden">
              <div className="grid md:grid-cols-2">
                {/* Image */}
                <div className="bg-black/5">
                  <img
                    src={gallery[activeIndex].src}
                    alt={
                      lang === "pt"
                        ? gallery[activeIndex].titlePT
                        : gallery[activeIndex].titleEN
                    }
                    className="w-full h-[55vh] md:h-[70vh] object-cover"
                  />
                </div>

                {/* “Post” sidebar */}
                <div className="p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-lg tracking-tight">
                        {t[lang].brand}
                      </div>
                      <div className="text-sm text-base-content/60">
                        @{instagramHandle}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={closeModal}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="text-xl font-bold tracking-tight">
                      {lang === "pt"
                        ? gallery[activeIndex].titlePT
                        : gallery[activeIndex].titleEN}
                    </div>
                    <p className="text-sm text-base-content/70 mt-2">
                      {lang === "pt"
                        ? gallery[activeIndex].descPT
                        : gallery[activeIndex].descEN}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="badge badge-secondary badge-outline">
                      {lang === "pt" ? "Feito sob encomenda" : "Custom made"}
                    </span>
                    <span className="badge badge-accent badge-outline">
                      {lang === "pt" ? "Eventos" : "Events"}
                    </span>
                    <span className="badge badge-accent badge-outline">
                      {lang === "pt" ? "Casamentos" : "Weddings"}
                    </span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      className="btn btn-primary"
                      href="#order"
                      onClick={closeModal}
                    >
                      {t[lang].ctaQuote}
                    </a>
                    <a
                      className="btn btn-secondary"
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t[lang].whatsapp}
                    </a>
                    <a
                      className="btn btn-ghost"
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t[lang].instagram}
                    </a>
                  </div>

                  <div className="mt-auto pt-6 text-xs text-base-content/60">
                    {t[lang].modalHint}
                  </div>

                  {/* Nav buttons */}
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={prev}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={next}
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile nav hint */}
              <div className="md:hidden p-3 border-t border-base-300 text-xs text-base-content/60 text-center">
                {t[lang].modalHint}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
