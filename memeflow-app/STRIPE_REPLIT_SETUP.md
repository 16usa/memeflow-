# MEMEFLOW Stripe + Replit setup

## Stripe Dashboard

1. Create product `MEMEFLOW Pro`.
2. Create a recurring monthly price for **USD 49.99**.
3. Copy its `price_...` ID into `STRIPE_PRICE_ID`.
4. Enable the Stripe Customer Portal and allow payment-method updates and subscription cancellation.
5. Add webhook endpoint:

   `https://YOUR-REPLIT-APP.replit.app/api/billing/webhook`

6. Subscribe the endpoint to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
7. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.

## Replit Secrets

Set:

- `APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- Solana RPC/WS secrets from `.env.example`

Never put secret keys in `index.html` or client-side JavaScript.

## Commands

```bash
npm test
npm run benchmark
npm start
```

`npm test` includes a complete signed mock cycle:

Free → Checkout → checkout.session.completed → active subscription → Pro entitlement → Portal → payment failure → LIVE revoked → cancellation → Free.

## Production verification

Use Stripe test mode first. Complete Checkout with a Stripe test card, verify that `/api/billing/status` changes to `active`, then trigger payment failure and cancellation from Stripe test tools. Switch to live keys only after the test webhook and Customer Portal both work on the published Replit HTTPS URL.

## Access rules

- Free or inactive subscription: PAPER only.
- Active/trialing subscription on the configured `STRIPE_PRICE_ID`: Pro entitlement.
- `past_due`, canceled, deleted, wrong price, invalid webhook signature: LIVE locked.
- Pro entitlement alone does not execute a trade. Wallet ownership and production execution gates must still pass.
