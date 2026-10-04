import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { fetchStripeConfig } from "./payments-api";

let stripePromise: Promise<Stripe | null> | null = null;

// Loads Stripe.js using the publishable key fetched from the backend at
// runtime (never baked into the frontend build), caching the promise so
// repeated Elements mounts don't re-fetch it.
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = fetchStripeConfig().then(({ publishable_key }) =>
      publishable_key ? loadStripe(publishable_key) : null,
    );
  }
  return stripePromise;
}
