# Stripe full-cycle audit

## Implemented

- Server-created Stripe Checkout subscription session.
- Fixed configured recurring Price ID.
- User ID stored in Checkout and Subscription metadata.
- Customer reuse for repeat Checkout.
- Customer Portal session.
- Raw-body webhook endpoint.
- HMAC SHA-256 Stripe signature verification with timestamp tolerance.
- Webhook idempotency by Stripe event ID.
- Subscription status persisted per server-side user.
- Entitlement granted only for active/trialing status and the configured Pro Price ID.
- Entitlement revoked for payment failure, cancellation, deletion, or non-matching price.
- LIVE endpoint checks Pro entitlement first and remains locked until wallet/execution integration passes.

## Automated cycle

`npm test` passes:

1. Free status.
2. Checkout session creation.
3. Correct subscription mode and configured Price ID.
4. Signed Checkout webhook.
5. Signed active-subscription webhook.
6. Pro entitlement enabled.
7. Customer Portal session creation.
8. LIVE proceeds to the next safety gate, not execution.
9. Payment failure revokes entitlement.
10. Duplicate webhook is idempotent.
11. Cancellation keeps LIVE locked.
12. Invalid webhook signature is rejected.

## Boundary

A real Stripe charge cannot be made without the owner's Stripe account keys and published HTTPS webhook URL. The package is wired and locally cycle-tested; the final Stripe test-mode transaction must be performed after Secrets are added to Replit.
