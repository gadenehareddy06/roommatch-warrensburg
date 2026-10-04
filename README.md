# RoomMatch

RoomMatch is a responsive rental discovery marketplace for property owners and room seekers. It includes deterministic compatibility scoring, advanced search, saved homes, private inquiries, owner property management, image uploads, and secure role-based access.

## What is included

- Polished landing page, responsive search/filter drawer, listing cards, property gallery, and mobile navigation
- Email/password authentication, signup role selection, and password reset via Supabase Auth
- Tenant dashboard with saved homes, comparison, inquiries, recommendations, and editable preferences
- Owner dashboard with portfolio stats, listing CRUD, availability controls, and inquiry status updates
- Deterministic RoomMatch Score: budget 30%, location 20%, tenant type 20%, property type 10%, amenities 10%, furnishing 5%, other preferences 5%
- Supabase Postgres schema, indexes, validation constraints, Storage bucket, Realtime inquiries, and strict RLS policies
- Six realistic fictional demo properties around Warrensburg, Missouri, and a fully interactive no-credentials demo mode
- GitHub Pages deployment workflow for the existing `/roommatch/` project path

## Run locally

Requirements: Node.js 24 LTS and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL shown by Vite (normally `http://localhost:5173/roommatch-warrensburg/`).

The app starts in **interactive demo mode** when Supabase values are absent. This is intentional: all main hackathon flows work immediately and persist in browser storage.

## Connect the backend

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. In Supabase Auth → URL Configuration, set the Site URL to your production URL and add local/preview redirect URLs, for example:
   - `http://localhost:5173/**`
   - `https://gadenehareddy06.github.io/roommatch-warrensburg/**`
4. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
5. Restart the dev server.
6. Create an owner account in the app. Optionally run `supabase/seed.sql` to add a database-backed demo property.

The anon key is designed for browser use. Never add a Supabase `service_role` key to this frontend. Authorization is enforced by the included database policies, not by hidden UI alone.

## Deploy to GitHub Pages

The repository includes `.github/workflows/deploy.yml` and Vite uses `/roommatch-warrensburg/` as its production base path.

1. Add repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. In repository Settings → Pages, choose **GitHub Actions** as the source.
3. Push to `main` or run the workflow manually.

For a different repository name, change `base` in `vite.config.ts`.

## Quality checks

```bash
npm run check
npm run build
npm run preview
```

Test both roles in demo mode using the account switcher in the top-right corner. For the live backend, create separate tenant and owner accounts because role changes are intentionally not exposed to the browser.

## Security notes

- Owners can create/update/delete only their own properties and images.
- Tenants cannot modify properties.
- Favorites and tenant preferences are private to their owner.
- Inquiries are readable only by the tenant who sent them and the owner of the referenced property.
- Only the property owner can update inquiry status.
- Public profiles contain only display name and role; email remains in Supabase Auth and is not queried for public listings.
- Image uploads are restricted to authenticated users' own Storage folders, accepted image MIME types, and 10 MB per file.
