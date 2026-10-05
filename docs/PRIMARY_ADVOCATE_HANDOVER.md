# Primary Advocate handover

The profile owner can request a handover to an active Co-Caregiver from Care Team → Review handover. The server provides a permission preview tied to current membership records. A confirmed request leaves all permissions unchanged until the nominated caregiver explicitly accepts within seven days.

Acceptance atomically transfers `care_recipients.owner_id`, the CareGroup authorization owner (`created_by`), and the direct/group membership roles. The outgoing advocate becomes a Co-Caregiver and receives a new 90-day access review. The incoming advocate becomes owner and their outstanding caregiver reviews are cancelled. Other memberships and care records stay unchanged.

The recipient can decline and the outgoing owner can cancel. Expired requests cannot be accepted. Only one unexpired request can be pending per profile. Changes to either participant's membership invalidate the preview and acceptance; cancel the stale request and start again.

## Boundaries

- Only the actual profile owner may initiate; another delegated primary advocate cannot transfer the owner's profile.
- Care Recipients and Family Members cannot receive ownership through this workflow.
- CareGroup-only active Co-Caregivers are supported; acceptance creates their direct owner membership.
- A CareGroup containing multiple profiles is rejected because a single-profile transfer would affect other profiles' permissions.
- No email or automatic permission change is triggered by expiry. Both participants receive in-app notifications for explicit lifecycle decisions.
- Notifications open the correct care profile. Decisions are recorded in both consent history and the care audit trail.

## Security and validation

The new table has participant-only SELECT RLS and no client write grants. Only the existing authenticated Edge Function can invoke the service-role-only transaction wrapper. The actor comes from `auth.getUser`, never the request body. The private implementation checks actor authorization, confirmation, expiry, eligible roles, ownership, and membership fingerprints under row locks. An audit or notification write failure rolls back the transfer.

The migration also repairs the live consent event CHECK constraint to admit the existing invitation-reminder, security-remediation, and recertification event types. A database regression test exercises an actual recertification sign-off under that constraint.

`tests/advocateHandover.test.ts` runs production SQL and the existing synchronization trigger in isolated PGlite PostgreSQL. It covers the handover lifecycle, unauthorized decisions, read-only recipient protection, stale state, expiry, synchronization, RLS, and atomic rollback. These are synthetic local fixtures; no test identities or care records are inserted into production.

Release checks: `npm run build:web`, `npm run smoke:dist`, `node scripts/security-audit.mjs`, and `npm run smoke:live`. Authenticated real-user device journeys still require pilot validation; database tests do not substitute for those journeys.
