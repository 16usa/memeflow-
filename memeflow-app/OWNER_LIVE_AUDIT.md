# Owner LIVE entitlement audit

Implemented:

- Server-only owner role.
- Private `OWNER_ACCESS_KEY` claim endpoint.
- Constant-time access-key comparison.
- Optional `OWNER_USER_IDS` automatic role assignment.
- Owner entitlement bypasses Stripe billing only.
- Stripe rules for all normal users remain unchanged.
- Payment failure or subscription cancellation cannot revoke an owner role.
- Owner role does not bypass wallet/risk/execution gates.
- Billing UI shows `OWNER · LIVE ENTITLED` and hides checkout/portal actions.
- Owner access key is never written to browser storage.

Automated checks:

- Free user is denied LIVE: passed.
- Wrong owner key is rejected: passed.
- Correct owner key grants owner role: passed.
- Owner billing status is returned correctly: passed.
- Owner reaches wallet/execution gate without Stripe: passed.
- Existing Stripe full-cycle test: passed.
- Existing integration test: passed.
