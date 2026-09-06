---
name: Artifact-managed workflows
description: Constraint on simplifying Replit workflows when registered artifacts still exist
---

Registered artifacts automatically regenerate their managed workflow and port entries. Those entries cannot be removed through ordinary workflow removal while the artifact remains registered.

**Why:** Attempts to remove the runtime-component workflows were rejected as artifact-managed, and validated `.replit` cleanup was followed by automatic restoration of their internal port mappings.

**How to apply:** Keep the product's main workflow as the only running user workflow. Treat artifact-managed entries as stopped internal registrations unless the user explicitly approves deregistering or deleting the corresponding artifacts and their code.