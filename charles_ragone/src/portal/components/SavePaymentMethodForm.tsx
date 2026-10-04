import { useEffect, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { createSetupIntent } from "../payments-api";
import { getStripe } from "../stripe";

export default function SavePaymentMethodForm({ onSaved }: { onSaved: () => void }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await createSetupIntent();
        setClientSecret(data.client_secret);
      } catch {
        setError("Couldn't start the card setup. Try again.");
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="alert alert-error text-sm">
        <span>{error}</span>
      </div>
    );
  }

  if (!clientSecret) {
    return <span className="loading loading-spinner" />;
  }

  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <SaveCardFields onSaved={onSaved} />
    </Elements>
  );
}

function SaveCardFields({ onSaved }: { onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Couldn't save that card.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      )}
      <button className="btn btn-primary btn-sm" disabled={!stripe || submitting}>
        {submitting ? "Saving..." : "Save card"}
      </button>
    </form>
  );
}
