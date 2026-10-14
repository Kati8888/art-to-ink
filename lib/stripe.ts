import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY server environment variable.");
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}
