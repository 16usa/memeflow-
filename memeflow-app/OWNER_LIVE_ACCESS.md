# MEMEFLOW owner LIVE access

The owner entitlement bypasses the $49.99 Stripe subscription only. It does not bypass wallet ownership, network, balance, fresh-data, risk, route, incident, kill-switch, or execution-engine checks.

## Replit Secret

Create a long random secret:

```text
OWNER_ACCESS_KEY=<at least 32 random characters>
```

Do not place this value in source code, HTML, screenshots, or chat messages.

## Activate owner access

1. Publish the app over HTTPS.
2. Open **Plans & Billing**.
3. Expand **Private owner access**.
4. Enter the value from `OWNER_ACCESS_KEY`.
5. Press **Activate owner access**.

The server marks only the current server account/session as owner. The key is not stored in localStorage. The server persists `isOwner`, `ownerGrantedAt`, and the grant source in its data store.

For a future authenticated account system, use `OWNER_USER_IDS` with stable authenticated user IDs. Multiple IDs are comma-separated:

```text
OWNER_USER_IDS=user-id-1,user-id-2
```

## Result

Billing status becomes:

```text
Plan: Owner
Status: Owner access
LIVE entitlement: Enabled
Renewal: No billing required
```

Calling LIVE execution without a verified wallet or production execution engine remains blocked with `LIVE_EXECUTION_NOT_READY`.
