import { useMemo, useState } from "react";
import cake_1 from "../assets/cake_1.webp";
import cake_2 from "../assets/cake_2.webp";
import cake_3 from "../assets/cake_3.webp";
import cake_4 from "../assets/cake_4.webp";

export default function HomePage() {
  const year = useMemo(() => new Date().getFullYear(), []);

  // Business contact / ordering
  const email = "orders@conceicaoconfefetteria.com"; // TODO: replace
  const phone = "(518) 000-0000"; // optional
  const instagramHandle = "kledna_conceicao";
  const instagramUrl = `https://instagram.com/${instagramHandle}`;
  const whatsappE164 = "+15180000000"; // TODO: replace (E.164)

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const gallery = [
    {
      src: cake_1,
      title: "Bolos de celebração",
      desc: "Designs sob medida, com acabamento elegante e muito sabor.",
    },
    {
      src: cake_2,
      title: "Cupcakes + docinhos",
      desc: "Perfeitos para festas e eventos — fáceis de servir.",
    },
    {
      src: cake_3,
      title: "Bolos para eventos",
      desc: "Estilo clean e moderno para casamentos e grandes momentos.",
    },
    {
      src: cake_4,
      title: "Mesas de doces",
      desc: "Um conjunto completo: bolo + doces combinando com seu tema.",
    },
  ];

  const mailtoHref = `mailto:${encodeURIComponent(
    email,
  )}?subject=${encodeURIComponent(
    "Pedido de Bolo Personalizado",
  )}&body=${encodeURIComponent(
    `Olá Conceição Confeitaria!

Data do evento:
Retirada ou entrega:
Porções:
Tipo (bolo/cupcakes/mesa de doces):
Tema/cores:
Sabores:
Alergias (se houver):
Links/fotos de inspiração:

Obrigada(o)!`,
  )}`;

  const whatsappHref = `https://wa.me/${whatsappE164.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Olá! Gostaria de um orçamento 😊

Data do evento:
Porções:
Tipo (bolo/cupcakes/mesa de doces):
Tema/cores:
Sabores:
Retirada ou entrega:
`,
  )}`;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      alert(`Copiado: ${email}`);
    } catch {
      alert(`E-mail: ${email}`);
    }
  };

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (activeIndex === null) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  };

  return (
    <div className="min-h-screen bg-base-200 text-base-content pb-24 sm:pb-0">
      {/* Top bar */}
      <div className="navbar max-w-6xl mx-auto px-4">
        <div className="flex-1">
          <a
            href="#top"
            className="text-xl md:text-2xl font-extrabold tracking-tight"
          >
            Conceição Confeitaria 🍰
          </a>
        </div>

        <div className="flex-none flex items-center gap-2">
          <a className="btn btn-ghost hidden sm:inline-flex" href="#gallery">
            Galeria
          </a>
          <a className="btn btn-primary" href="#order">
            Orçamento
          </a>
        </div>
      </div>

      {/* Hero */}
      <section id="top" className="max-w-6xl mx-auto px-4 pt-4 pb-8">
        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
          <div className="card bg-base-100 shadow-xl border border-base-300">
            <div className="card-body">
              <span className="badge badge-success badge-outline w-fit text-xs sm:text-sm whitespace-normal text-center">
                Bolos sob encomenda • Cupcakes • Mesas de doces • Eventos
              </span>

              <h1 className="text-3xl md:text-5xl font-extrabold mt-3 leading-tight tracking-tight">
                Bolos personalizados para{" "}
                <span className="text-primary">casamentos, aniversários</span> e
                momentos inesquecíveis.
              </h1>

              <p className="text-base md:text-lg text-base-content/80 mt-3 max-w-xl">
                Sabor marcante, design elegante e aquele toque caseiro feito com
                carinho — para impressionar e encantar.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a className="btn btn-primary" href="#order">
                  Pedir orçamento
                </a>
                <a className="btn btn-outline" href="#gallery">
                  Ver galeria
                </a>
                <a className="btn btn-ghost" href="#how">
                  Como funciona →
                </a>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <div className="badge badge-accent badge-outline">
                  Design exclusivo
                </div>
                <div className="badge badge-accent badge-outline">
                  Ingredientes frescos
                </div>
                <div className="badge badge-accent badge-outline">
                  Pronto para eventos
                </div>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-base-200 border border-base-300">
                <div className="font-semibold">Dica rápida</div>
                <p className="text-sm text-base-content/70 mt-1">
                  Envie data, porções, tema/cores e fotos de inspiração —
                  respondemos com disponibilidade + valores.
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
            <figure className="h-72 sm:h-80 lg:h-full">
              <img
                src={cake_1}
                alt="Bolo personalizado"
                className="w-full h-full object-cover"
                loading="eager"
              />
            </figure>
            <div className="card-body">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-bold">Bolo em destaque</div>
                  <div className="text-sm text-base-content/70">
                    Um exemplo do nosso acabamento e estilo.
                  </div>
                </div>
                <a className="btn btn-sm btn-secondary" href="#order">
                  Quero esse estilo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="max-w-6xl mx-auto px-4 pb-12">
        <div className="mb-5">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Bolos que são pura poesia 💐
          </h2>
          <p className="text-base-content/70 mt-1 max-w-3xl">
            Escolha o estilo, defina os sabores e a gente cria algo inesquecível
            para o seu evento.
          </p>
        </div>

        {/* Mobile-first: 1 col -> 2 -> 4 */}
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {gallery.map((g, idx) => (
            <button
              key={idx}
              type="button"
              className="group relative aspect-[4/3] sm:aspect-square overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-xl"
              onClick={() => openModal(idx)}
              aria-label={g.title}
            >
              <img
                src={g.src}
                alt={g.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                <div className="text-primary-content font-semibold text-sm">
                  {g.title}
                </div>
                <div className="text-primary-content/80 text-xs mt-0.5 line-clamp-2">
                  {g.desc}
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
            <span>
              Pronta(o) para pedir? Envie a data + porções — a gente responde
              com um orçamento.
            </span>
            <a className="btn btn-sm btn-secondary" href="#order">
              Pedir orçamento
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-4 pb-12">
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Como funciona
            </h2>
            <p className="text-base-content/70">
              Simples, rápido e pensado para o seu evento.
            </p>

            <div className="grid lg:grid-cols-3 gap-4 mt-6">
              <div className="p-5 rounded-2xl border border-base-300 bg-base-200">
                <div className="font-bold text-lg">1) Envie os detalhes</div>
                <p className="text-sm text-base-content/70 mt-1">
                  Data, número de porções, tema/cores, sabores e fotos de
                  inspiração.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-base-300 bg-base-200">
                <div className="font-bold text-lg">2) Receba o orçamento</div>
                <p className="text-sm text-base-content/70 mt-1">
                  Confirmamos disponibilidade + valores e tiramos suas dúvidas.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-base-300 bg-base-200">
                <div className="font-bold text-lg">3) Retirada ou entrega</div>
                <p className="text-sm text-base-content/70 mt-1">
                  Fechamos o design e seu bolo fica pronto para o grande dia.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn btn-primary" href="#order">
                Pedir orçamento
              </a>
              <a className="btn btn-ghost" href="#contact">
                Contato
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Order (simplified: email/whatsapp first, optional short form) */}
      <section id="order" className="max-w-6xl mx-auto px-4 pb-14">
        <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
          <div className="card-body">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-[40%]">
                <h2 className="text-3xl font-extrabold tracking-tight">
                  Solicite um <span className="text-primary">orçamento</span>
                </h2>

                <p className="text-base-content/70 mt-2">
                  Clique para enviar uma mensagem pronta (WhatsApp) ou um e-mail
                  com tudo que precisamos.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
                  <a className="btn btn-primary" href={mailtoHref}>
                    E-mail (pré-preenchido)
                  </a>
                  <a
                    className="btn btn-secondary"
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                  <button
                    className="btn btn-outline"
                    onClick={copyEmail}
                    type="button"
                  >
                    Copiar e-mail
                  </button>
                </div>

                <p className="mt-4 text-sm text-base-content/60">
                  Dica: envie fotos de inspiração para agilizar o orçamento.
                </p>
              </div>

              {/* Optional short form -> opens email with a generated body */}
              <div className="lg:flex-1">
                <div className="rounded-2xl border border-base-300 bg-base-100 shadow-xl">
                  <div className="p-4 border-b border-base-300">
                    <div className="font-semibold text-lg">Pedido rápido</div>
                    <p className="text-sm text-base-content/60">
                      Preencha o básico — ao enviar, abrimos seu e-mail pronto
                      para mandar.
                    </p>
                  </div>

                  <QuickEmailForm toEmail={email} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card bg-base-100 shadow-xl border border-base-300">
            <div className="card-body">
              <h2 className="text-2xl font-bold tracking-tight">
                Contato + pedidos
              </h2>
              <p className="text-base-content/70">
                Envie a data do evento, porções, tema/cores e inspirações para
                um orçamento rápido.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <a className="btn btn-primary" href={mailtoHref}>
                  Enviar e-mail
                </a>

                <a
                  className="btn btn-secondary"
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>

                <a
                  className="btn btn-ghost"
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram @{instagramHandle}
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
                Perguntas frequentes
              </h3>
              <div className="space-y-3 text-sm text-base-content/70">
                <div>
                  <div className="font-semibold text-base-content">
                    Com quanta antecedência devo pedir?
                  </div>
                  <div>
                    Idealmente 1–2 semanas (mais para casamentos e eventos
                    grandes).
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-base-content">
                    Vocês fazem entrega?
                  </div>
                  <div>
                    Sim — inclua o endereço no pedido para confirmarmos a
                    taxa/rota.
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-base-content">
                    Consegue combinar com um tema?
                  </div>
                  <div>
                    Sim! Envie cores/fotos e a gente cria no seu estilo.
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <a className="btn btn-secondary w-full" href="#order">
                  Começar meu pedido
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky bottom CTA for mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
        <div className="mx-auto max-w-6xl px-3 pb-3">
          <div className="bg-base-100/95 backdrop-blur border border-base-300 shadow-xl rounded-2xl p-3 flex gap-2">
            <a className="btn btn-primary flex-1" href="#order">
              Pedir orçamento
            </a>
            <a
              className="btn btn-secondary"
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <footer className="footer footer-center p-6 bg-base-300 text-base-content">
        <aside>
          <p>© {year} Conceição Confeitaria • Bolos & Doces</p>
        </aside>
      </footer>

      {/* Modal */}
      {activeIndex !== null && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          onKeyDown={onKeyDown}
          tabIndex={-1}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={closeModal}
            aria-label="Fechar"
          />

          <div className="relative max-w-5xl mx-auto h-full flex items-center justify-center p-3">
            <div className="w-full bg-base-100 border border-base-300 rounded-3xl shadow-2xl overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="bg-black/5">
                  <img
                    src={gallery[activeIndex].src}
                    alt={gallery[activeIndex].title}
                    className="w-full h-[55vh] md:h-[70vh] object-cover"
                  />
                </div>

                <div className="p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-lg tracking-tight">
                        Conceição Confeitaria 🍰
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
                      {gallery[activeIndex].title}
                    </div>
                    <p className="text-sm text-base-content/70 mt-2">
                      {gallery[activeIndex].desc}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      className="btn btn-primary"
                      href="#order"
                      onClick={closeModal}
                    >
                      Pedir orçamento
                    </a>
                    <a
                      className="btn btn-secondary"
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                    <a
                      className="btn btn-ghost"
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Instagram
                    </a>
                  </div>

                  <div className="mt-auto pt-6 text-xs text-base-content/60">
                    Use as setas para navegar • ESC para fechar
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      className="btn btn-outline btn-wide"
                      onClick={prev}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-wide"
                      onClick={next}
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>

              <div className="md:hidden p-3 border-t border-base-300 text-xs text-base-content/60 text-center">
                Use as setas para navegar • ESC para fechar
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small mobile-friendly form that opens the user's email client with a filled body */
function QuickEmailForm({ toEmail }: { toEmail: string }) {
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [date, setDate] = useState("");
  const [servings, setServings] = useState("");
  const [kind, setKind] = useState("Bolo personalizado");
  const [pickupDelivery, setPickupDelivery] = useState("Retirada");
  const [theme, setTheme] = useState("");
  const [flavors, setFlavors] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const subject = "Pedido de Orçamento - Conceição Confeitaria";
    const body = `Olá Conceição Confeitaria!

Nome: ${name}
E-mail: ${fromEmail}

Data do evento: ${date}
Porções: ${servings || "-"}
Tipo: ${kind}
Retirada ou entrega: ${pickupDelivery}

Tema/cores: ${theme || "-"}
Sabores: ${flavors || "-"}
Alergias: ${allergies || "-"}

Observações / inspiração:
${notes || "-"}

Obrigada(o)!`;

    const href = `mailto:${encodeURIComponent(
      toEmail,
    )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = href;
  };

  return (
    <form className="p-4 space-y-4" onSubmit={onSubmit}>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">
            <span className="label-text">Seu nome</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Seu nome"
            className="input input-bordered w-full"
          />
        </div>

        <div>
          <label className="label">
            <span className="label-text">E-mail</span>
          </label>
          <input
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            required
            type="email"
            placeholder="voce@email.com"
            className="input input-bordered w-full"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="label">
            <span className="label-text">Data do evento</span>
          </label>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            type="date"
            className="input input-bordered w-full"
          />
        </div>

        <div>
          <label className="label">
            <span className="label-text">Porções</span>
          </label>
          <input
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            type="number"
            min={6}
            placeholder="20"
            className="input input-bordered w-full"
          />
        </div>

        <div>
          <label className="label">
            <span className="label-text">Tipo</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option>Bolo personalizado</option>
            <option>Cupcakes</option>
            <option>Mesa de doces</option>
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">
            <span className="label-text">Retirada ou entrega</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={pickupDelivery}
            onChange={(e) => setPickupDelivery(e.target.value)}
          >
            <option>Retirada</option>
            <option>Entrega</option>
          </select>
        </div>

        <div>
          <label className="label">
            <span className="label-text">Alergias (opcional)</span>
          </label>
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="Nozes, glúten, lactose…"
            className="input input-bordered w-full"
          />
        </div>
      </div>

      <div>
        <label className="label">
          <span className="label-text">Tema/cores</span>
        </label>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Ex: rosé, flores, minimalista…"
          className="input input-bordered w-full"
        />
      </div>

      <div>
        <label className="label">
          <span className="label-text">Sabores</span>
        </label>
        <input
          value={flavors}
          onChange={(e) => setFlavors(e.target.value)}
          placeholder="Ex: chocolate, baunilha, morango…"
          className="input input-bordered w-full"
        />
      </div>

      <div>
        <label className="label">
          <span className="label-text">Observações / inspiração</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Cole links do Pinterest/Instagram e detalhes do evento."
          className="textarea textarea-bordered w-full"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn btn-primary">
          Abrir e-mail pronto 🍰
        </button>
      </div>
    </form>
  );
}
