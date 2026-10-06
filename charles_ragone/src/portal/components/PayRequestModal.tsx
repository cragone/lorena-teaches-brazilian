import { useEffect, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { payPaymentRequest, syncPaymentRequest, formatCents, estimateFeeCents, FEE_DESCRIPTIONS, type PayMethod } from "../payments-api";
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
            <PayFields request={request} onPaid={onPaid} onClose={onClose} />
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

function PayFields({ request, onPaid, onClose }: { request: PaymentRequest; onPaid: () => void; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>("card");
  const fee = estimateFeeCents(method, request.amount_cents);
  const methodName = method === "card" ? "Card" : "Bank account (ACH)";

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

    // Stripe confirmed the PaymentIntent; reconcile our record now rather
    // than waiting on the webhook so the list shows "succeeded" right away.
    try {
      await syncPaymentRequest(request.id);
    } catch {
      // The webhook will still catch this up if the sync call fails.
    }

    setSubmitting(false);
    onPaid();
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        onChange={(e) => {
          if (e.value.type === "card" || e.value.type === "us_bank_account") setMethod(e.value.type);
        }}
      />
      <div className="rounded-box bg-base-200 p-3 text-sm">
        <div className="flex justify-between">
          <span>Amount due</span>
          <span>{formatCents(request.amount_cents, request.currency)}</span>
        </div>
        <p className="mt-2 text-xs opacity-70">
          {methodName} processing fee: {FEE_DESCRIPTIONS[method]} (about {formatCents(fee, request.currency)} on this
          payment). {method === "card" ? "Pay by bank account (ACH) for lower fees." : "Bank payments can take a few business days to clear."}
        </p>
      </div>
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
