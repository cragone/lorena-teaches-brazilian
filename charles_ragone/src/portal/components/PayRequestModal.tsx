import { useEffect, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { payPaymentRequest, formatCents } from "../payments-api";
import { getStripe } from "../stripe";
import type { PaymentRequest } from "../types";

export default function PayRequestModal({
  request,
  onClose,
  onPaid,
}: {
  request: PaymentRequest;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await payPaymentRequest(request.id);
        setClientSecret(data.client_secret);
      } catch {
        setError("Couldn't start the payment. Try again.");
      }
    })();
  }, [request.id]);

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-semibold">Pay {formatCents(request.amount_cents, request.currency)}</h3>
        <p className="mb-4 text-sm opacity-70">{request.description}</p>

        {error && (
          <div className="alert alert-error mb-4 text-sm">
            <span>{error}</span>
          </div>
        )}

        {clientSecret ? (
          <Elements stripe={getStripe()} options={{ clientSecret }}>
            <PayFields onPaid={onPaid} onClose={onClose} />
          </Elements>
        ) : !error ? (
          <span className="loading loading-spinner" />
        ) : null}

        <div className="modal-action">
          <button className="btn btn-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PayFields({ onPaid, onClose }: { onPaid: () => void; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onPaid();
    onClose();
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
        {submitting ? "Paying..." : "Pay now"}
      </button>
    </form>
  );
}
