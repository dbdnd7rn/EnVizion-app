# EnVizion Life authentication branding setup

The app code supports branded email/password authentication and Google OAuth. The provider dashboards must also be configured because sender identity, SMTP delivery and OAuth credentials cannot be embedded in the APK.

## Branded authentication email

1. Configure a production SMTP provider in Supabase at:
   `https://supabase.com/dashboard/project/nvmepknmkptltnuxdyfv/auth/smtp`
2. Set the sender name to `EnVizion Life` and use a verified From address such as `no-reply@auth.your-domain.com`.
3. In **Authentication > Email Templates > Confirm signup**:
   - Subject: `Confirm your EnVizion Life account`
   - Paste the contents of `supabase/email-templates/confirmation.html`.
4. In **Authentication > Email Templates > Reset password**:
   - Subject: `Reset your EnVizion Life password`
   - Paste the contents of `supabase/email-templates/recovery.html`.

Using custom SMTP is what replaces the visible `Supabase Auth` sender name. Editing the HTML template alone does not change the sender.

## Google sign-in

1. In Google Cloud Console, configure the OAuth consent screen:
   - App name: `EnVizion Life`
   - Add the EnVizion Life logo, support email, privacy-policy URL and terms URL.
   - Request only `openid`, `email` and `profile` scopes.
2. Create an OAuth 2.0 **Web application** client.
3. Add this authorized redirect URI exactly:
   `https://nvmepknmkptltnuxdyfv.supabase.co/auth/v1/callback`
4. In Supabase **Authentication > Sign In / Providers > Google**, enable Google and save the Google client ID and client secret.
5. In Supabase **Authentication > URL Configuration**, add these redirect URLs:
   - `envizionlife://auth/confirmed`
   - `https://envizion-life-caregiver.onrender.com/`
6. Publish the Google OAuth consent screen for production, or add every tester as a test user while it remains in testing mode.

Never commit the Google client secret or SMTP password to this repository.
