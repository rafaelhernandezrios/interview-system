import express from "express";
import Application from "../models/Application.js";
import { getStripe } from "../utils/stripeClient.js";

const router = express.Router();

/**
 * Stripe webhook — must be mounted with express.raw({ type: 'application/json' })
 * before the global express.json() middleware.
 */
router.post("/", async (req, res) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ message: "Webhook not configured" });
  }

  const signature = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (!userId) {
        console.warn("Stripe checkout.session.completed without userId metadata");
        return res.json({ received: true });
      }

      if (session.payment_status !== "paid") {
        return res.json({ received: true });
      }

      await Application.findOneAndUpdate(
        { userId },
        {
          registrationFeeStatus: "paid",
          registrationFeePaidAt: new Date(),
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id || null,
        }
      );
    }
  } catch (error) {
    console.error("Error handling Stripe webhook:", error);
    return res.status(500).json({ message: "Webhook handler failed" });
  }

  res.json({ received: true });
});

export default router;
