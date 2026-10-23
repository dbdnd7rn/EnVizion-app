# EnVizion Life — branded care invitation emails

The app supports two **different Supabase Auth email flows**:

| Recipient | Supabase Auth method | Template |
|---|---|---|
| Email address not yet registered | `auth.admin.inviteUserByEmail` | `supabase/email-templates/invite.html` |
| Existing EnVizion account with a pending care invitation | `auth.signInWithOtp` | `supabase/email-templates/magiclink.html` |

**Important:** Committing HTML to this repository or deploying an Edge Function does **not** update a hosted Supabase project's Authentication email templates.

## Hosted project configuration (manual dashboard setup)

1. Open the **EnVizion Life Supabase project only**, project `nvmepknmkptltnuxdyfv`: https://supabase.com/dashboard/project/nvmepknmkptltnuxdyfv/auth/templates
2. Under **Authentication → Email Templates → Magic Link**, replace the existing HTML with the complete contents of [magiclink.html](./magiclink.html). Set subject to **EnVizion Life | Your secure sign-in link** and save.
3. Under **Invite user**, use the content of [invite.html](./invite.html). Set subject to **EnVizion Life | Your care team invitation** and save.
4. If the sender still reads **Supabase Auth**, configure a verified custom sending domain and SMTP provider in **Authentication → SMTP Settings**. Changing the HTML does not change the From address.
5. Use an existing confirmed test account with a pending invite and press **Send invitation reminder**. Verify the received message identifies the *real* inviting Primary Advocate, care profile, invited role and acceptance instructions. Also test a normal Magic Link sign-in for an account with **no pending invitation** to confirm the neutral fallback.
6. Always check delivery and links on real email clients. A returned success from Supabase means the email request was accepted; it is not inbox-delivery proof.

## Privacy and access invariants

- The Edge Function prepares a display-only Auth metadata snapshot based on the server-side pending membership; it includes inviter display name, care profile name, invited role and invitation expiry, but **never** medication/vitals/health records.
- An invitation is **pending** until the invited authenticated person selects **Accept** in the application.
- The email's one-time login link expires independently of the **14-day** care invitation.
- Only a valid authenticated Primary Advocate can invite/send a reminder. No anonymous endpoint sends invites; the Edge Function continues to require a JWT.
- User metadata is used **only for email presentation**, never for RLS, authorization or membership decisions. Stale invitation metadata is cleared on acceptance, decline and revoke for that care profile.
- The Magic Link template also serves ordinary passwordless sign-ins; users without invitation context see a neutral sign-in email.

## Deployment verification

- CI: TypeScript, domain tests, Expo web export, artifact smoke and dependency audit.
- Deploy `supabase/functions/care-team-admin/index.ts` through the connected Supabase tool with `verify_jwt=true`; confirm the new version is active.
- Merge to `main`, deploy existing Render service and verify release commit is `live`.
- Finally configure hosted Supabase Auth templates in the dashboard (step 1–3 above). Backend deployment **alone is insufficient** to activate the branded email.
