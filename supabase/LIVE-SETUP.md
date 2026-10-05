# Live project setup

The existing Warrensburg Supabase project was upgraded on October 5, 2026 using
`upgrade-existing-project.sql`. This is a one-time migration for the older
four-table database with bigint property IDs, not for a fresh database. Do not
rerun `schema.sql` over the existing project. Existing accounts and 24 listings
were preserved.

## Where account data lives

- Authentication > Users: Supabase-managed accounts and email confirmation.
- Table Editor > profiles: ID, name, role, email, creation time and last sign-in time.
- Passwords must never be copied into profiles. Supabase Auth manages credentials.
- Profiles remain private: signed-out visitors cannot read them; each signed-in
  user can read only their own profile. Users cannot change their role or email
  through a direct profile update.
- A signup trigger creates the profile. A separate auth update trigger keeps
  email and last-sign-in time synchronized. Login updates a record, not a new row.

The published frontend uses GitHub Actions secrets `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`. These identify the same project as the dashboard.
Only the publishable browser key is used, never a secret or service-role key.
Rebuild the website after changing these values.

Site URL and allowed redirect:
`https://gadenehareddy06.github.io/roommatch-warrensburg/`

## Verify with your own account

1. Open the published site, select Sign in / Sign up, then Create account.
2. Use an email you control and choose owner or tenant. Enter your password yourself.
3. Complete email verification if Supabase requires it, then sign in.
4. Refresh Authentication > Users and Table Editor > profiles. Check the new ID,
   email, role and last-sign-in time. Signing in again updates the same row.
5. Use two separate accounts to demonstrate owner and tenant experiences.

Old browser-only demo accounts were not real Supabase accounts and were not
imported. Register them through the live signup form. This migration does not
configure SMTP delivery or storage buckets; those require separate verification
before claiming the entire marketplace is production-ready.
