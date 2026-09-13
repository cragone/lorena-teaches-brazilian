import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createBooking,
  fetchAvailability,
  fetchServices,
  formatPrice,
  type Booking,
  type Service,
  type Slot,
} from "../lib/api";

type Step = "service" | "time" | "details" | "done";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function maxDateISO() {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTimeLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const preselectSlug = searchParams.get("service");

  const [step, setStep] = useState<Step>("service");

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [name, setName] = useState("");
  const [emailAddr, setEmailAddr] = useState("");
  const [phone, setPhone] = useState("");
  const [languagePair, setLanguagePair] = useState("Portuguese <> English");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  useEffect(() => {
    fetchServices()
      .then((res) => {
        setServices(res.services);
        if (preselectSlug) {
          const match = res.services.find((s) => s.slug === preselectSlug);
          if (match) setSelectedService(match);
        }
      })
      .catch(() => setServicesError("Couldn't load services. Please refresh and try again."))
      .finally(() => setServicesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedService || step !== "time") return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    fetchAvailability(date, selectedService.id)
      .then((res) => setSlots(res.slots))
      .catch((err) => setSlotsError(err.message || "Couldn't load availability."))
      .finally(() => setSlotsLoading(false));
  }, [date, selectedService, step]);

  const maxDate = useMemo(maxDateISO, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createBooking({
        serviceId: selectedService.id,
        date,
        startTime: selectedSlot.startTime,
        clientName: name,
        clientEmail: emailAddr,
        clientPhone: phone || undefined,
        languagePair,
        notes: notes || undefined,
      });
      setConfirmed(res.booking);
      setStep("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const steps: { key: Step; label: string }[] = [
    { key: "service", label: "Service" },
    { key: "time", label: "Date & time" },
    { key: "details", label: "Your details" },
    { key: "done", label: "Confirmed" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-base-200 text-base-content">
      <div className="h-1.5 bg-primary" />

      <div className="navbar max-w-3xl mx-auto px-4">
        <div className="flex-1">
          <Link className="btn btn-ghost text-base sm:text-xl font-bold px-2 whitespace-nowrap" to="/">
            Lorena <span className="font-normal">Interpreting</span>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-16">
        <ul className="steps w-full mb-8">
          {steps.map((s, i) => (
            <li
              key={s.key}
              className={`step ${i <= stepIndex ? "step-primary" : ""}`}
            >
              {s.label}
            </li>
          ))}
        </ul>

        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body">
            {step === "service" && (
              <>
                <h1 className="text-2xl font-bold mb-1">Choose a service</h1>
                <p className="text-base-content/70 mb-4">
                  What kind of interpreting do you need?
                </p>

                {servicesLoading && (
                  <div className="flex justify-center py-8">
                    <span className="loading loading-spinner loading-lg" />
                  </div>
                )}
                {servicesError && (
                  <div className="alert alert-error">{servicesError}</div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedService(service)}
                      className={`text-left card border ${
                        selectedService?.id === service.id
                          ? "border-primary bg-primary/10"
                          : "border-base-300 bg-base-100"
                      }`}
                    >
                      <div className="card-body p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold">{service.name}</div>
                          <div className="badge badge-primary badge-outline whitespace-nowrap">
                            {formatPrice(service.price_cents)}
                          </div>
                        </div>
                        <div className="text-xs text-base-content/70">
                          {service.description}
                        </div>
                        <div className="text-xs text-base-content/50">
                          {service.duration_minutes} minutes
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="card-actions justify-end mt-6">
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={!selectedService}
                    onClick={() => setStep("time")}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {step === "time" && selectedService && (
              <>
                <h1 className="text-2xl font-bold mb-1">Pick a date &amp; time</h1>
                <p className="text-base-content/70 mb-4">
                  Booking a <b>{selectedService.name}</b> ({selectedService.duration_minutes}{" "}
                  min). All times are Eastern Time (US).
                </p>

                <label className="form-control w-full max-w-xs mb-4">
                  <div className="label">
                    <span className="label-text">Date</span>
                  </div>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={date}
                    min={todayISO()}
                    max={maxDate}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>

                <div className="mb-2 font-semibold text-sm">
                  {formatDateLabel(date)}
                </div>

                {slotsLoading && (
                  <div className="flex justify-center py-8">
                    <span className="loading loading-spinner loading-lg" />
                  </div>
                )}
                {slotsError && <div className="alert alert-error">{slotsError}</div>}
                {!slotsLoading && !slotsError && slots.length === 0 && (
                  <div className="alert alert-warning">
                    No openings on this date. Try another day.
                  </div>
                )}

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`btn btn-sm ${
                        selectedSlot?.startTime === slot.startTime
                          ? "btn-primary"
                          : "btn-outline"
                      }`}
                    >
                      {formatTimeLabel(slot.startTime)}
                    </button>
                  ))}
                </div>

                <div className="card-actions justify-between mt-6">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setStep("service")}
                  >
                    Back
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={!selectedSlot}
                    onClick={() => setStep("details")}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {step === "details" && selectedService && selectedSlot && (
              <form onSubmit={handleSubmit}>
                <h1 className="text-2xl font-bold mb-1">Your details</h1>
                <p className="text-base-content/70 mb-4">
                  {selectedService.name} on {formatDateLabel(date)} at{" "}
                  {formatTimeLabel(selectedSlot.startTime)}
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">Full name</span>
                    </div>
                    <input
                      required
                      className="input input-bordered"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>

                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">Email</span>
                    </div>
                    <input
                      required
                      type="email"
                      className="input input-bordered"
                      value={emailAddr}
                      onChange={(e) => setEmailAddr(e.target.value)}
                    />
                  </label>

                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">Phone (optional)</span>
                    </div>
                    <input
                      className="input input-bordered"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>

                  <label className="form-control w-full">
                    <div className="label">
                      <span className="label-text">Language pair</span>
                    </div>
                    <input
                      required
                      className="input input-bordered"
                      value={languagePair}
                      onChange={(e) => setLanguagePair(e.target.value)}
                    />
                  </label>
                </div>

                <label className="form-control w-full mt-4">
                  <div className="label">
                    <span className="label-text">
                      Anything Lorena should know? (optional)
                    </span>
                  </div>
                  <textarea
                    className="textarea textarea-bordered"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>

                {submitError && (
                  <div className="alert alert-error mt-4">{submitError}</div>
                )}

                <div className="card-actions justify-between mt-6">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setStep("time")}
                  >
                    Back
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      "Confirm booking"
                    )}
                  </button>
                </div>
              </form>
            )}

            {step === "done" && confirmed && (
              <>
                <div className="text-5xl mb-2">✅</div>
                <h1 className="text-2xl font-bold mb-1">Booking requested!</h1>
                <p className="text-base-content/70 mb-4">
                  Lorena will follow up by email at <b>{confirmed.client_email}</b>{" "}
                  to confirm. Save your reference number below.
                </p>

                <div className="rounded-2xl border border-base-300 p-4 bg-base-200">
                  <div className="flex justify-between py-1">
                    <span className="text-base-content/60">Reference</span>
                    <span className="font-mono font-bold">{confirmed.reference}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-base-content/60">Service</span>
                    <span>{confirmed.service_name}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-base-content/60">When</span>
                    <span>
                      {formatDateLabel(confirmed.date)} at{" "}
                      {formatTimeLabel(confirmed.start_time)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-base-content/60">Status</span>
                    <span className="badge badge-warning badge-outline">
                      {confirmed.status}
                    </span>
                  </div>
                </div>

                <div className="card-actions justify-end mt-6">
                  <Link className="btn btn-primary" to="/">
                    Back to home
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
