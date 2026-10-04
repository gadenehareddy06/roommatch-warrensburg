-- RoomMatch database schema for Supabase/Postgres.
-- Run this once in the Supabase SQL editor, then add the web URL to Auth > URL Configuration.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('owner', 'tenant');
create type public.property_status as enum ('available', 'rented');
create type public.inquiry_status as enum ('sent', 'viewed', 'responded', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  role public.user_role not null default 'tenant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 3000),
  address text not null,
  city text not null,
  state text not null check (state ~ '^[A-Z]{2}$'),
  zip_code text not null check (zip_code ~ '^\d{5}(-\d{4})?$'),
  locality text not null,
  landmark text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  property_type text not null check (property_type in ('Private Room','Shared Room','Studio','1 Bedroom','2 Bedroom','3+ Bedroom')),
  number_of_rooms smallint not null default 1 check (number_of_rooms > 0),
  rent numeric(12,2) not null check (rent > 0),
  deposit numeric(12,2) not null default 0 check (deposit >= 0),
  maintenance numeric(12,2) not null default 0 check (maintenance >= 0),
  electricity_charge numeric(12,2) not null default 0 check (electricity_charge >= 0),
  water_charge numeric(12,2) not null default 0 check (water_charge >= 0),
  available_from date not null,
  status public.property_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_preferences (
  property_id uuid primary key references public.properties(id) on delete cascade,
  students boolean not null default false,
  bachelors boolean not null default false,
  working_professionals boolean not null default false,
  families boolean not null default false,
  senior_citizens boolean not null default false,
  anyone boolean not null default false,
  gender_preference text not null default 'Any' check (gender_preference in ('Any','Women','Men')),
  pets_allowed boolean not null default false,
  smoking_allowed boolean not null default false,
  food_restrictions text not null default 'No preference',
  constraint at_least_one_tenant_type check (students or bachelors or working_professionals or families or senior_citizens or anyone)
);

create table public.property_amenities (
  property_id uuid primary key references public.properties(id) on delete cascade,
  wifi boolean not null default false,
  parking boolean not null default false,
  attached_bathroom boolean not null default false,
  ac boolean not null default false,
  kitchen boolean not null default false,
  washing_machine boolean not null default false,
  power_backup boolean not null default false,
  furnishing text not null default 'Unfurnished' check (furnishing in ('Furnished','Partially Furnished','Unfurnished'))
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  image_url text not null,
  storage_path text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index one_primary_image_per_property on public.property_images(property_id) where is_primary;

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 10 and 2000),
  move_in_date date not null,
  contact_preference text not null default 'In-app chat',
  status public.inquiry_status not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_city text,
  preferred_locality text,
  min_budget numeric(12,2) not null default 0 check (min_budget >= 0),
  max_budget numeric(12,2) not null default 5000 check (max_budget > 0 and max_budget >= min_budget),
  property_type text,
  tenant_type text,
  furnishing text,
  required_amenities text[] not null default '{}',
  pets_required boolean not null default false,
  food_preference text not null default 'No preference',
  updated_at timestamptz not null default now()
);

create table public.tenant_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  description text not null check (char_length(description) between 10 and 1000),
  city text not null,
  locality text,
  max_budget numeric(12,2) not null check (max_budget > 0),
  property_type text,
  tenant_type text,
  status text not null default 'open' check (status in ('open','matched','closed')),
  created_at timestamptz not null default now()
);

create index properties_owner_idx on public.properties(owner_id);
create index properties_search_idx on public.properties(city, locality, status, rent);
create index inquiries_property_idx on public.inquiries(property_id);
create index inquiries_tenant_idx on public.inquiries(tenant_id);
create index favorites_user_idx on public.favorites(user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger properties_updated before update on public.properties for each row execute function public.set_updated_at();
create trigger inquiries_updated before update on public.inquiries for each row execute function public.set_updated_at();
create trigger tenant_preferences_updated before update on public.tenant_preferences for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'role' = 'owner' then 'owner'::public.user_role else 'tenant'::public.user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_preferences enable row level security;
alter table public.property_amenities enable row level security;
alter table public.property_images enable row level security;
alter table public.favorites enable row level security;
alter table public.inquiries enable row level security;
alter table public.tenant_preferences enable row level security;
alter table public.tenant_requirements enable row level security;

-- Explicit grants: anon can only read marketplace-safe rows; authenticated users get
-- operations that are still constrained row-by-row by the policies below.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.properties, public.property_preferences, public.property_amenities, public.property_images to anon, authenticated;
grant insert, update(name) on public.profiles to authenticated;
grant insert, update, delete on public.properties, public.property_preferences, public.property_amenities, public.property_images to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update(status) on public.inquiries to authenticated;
grant select, insert, update, delete on public.tenant_preferences, public.tenant_requirements to authenticated;

create policy "Public can read safe profiles" on public.profiles for select to anon, authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Properties are public" on public.properties for select to anon, authenticated using (true);
create policy "Owners create properties" on public.properties for insert to authenticated with check ((select auth.uid()) = owner_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'owner'));
create policy "Owners update own properties" on public.properties for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete own properties" on public.properties for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "Property preferences are public" on public.property_preferences for select to anon, authenticated using (true);
create policy "Owners insert property preferences" on public.property_preferences for insert to authenticated with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "Owners update property preferences" on public.property_preferences for update to authenticated using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid()))) with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "Owners delete property preferences" on public.property_preferences for delete to authenticated using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

create policy "Property amenities are public" on public.property_amenities for select to anon, authenticated using (true);
create policy "Owners insert property amenities" on public.property_amenities for insert to authenticated with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "Owners update property amenities" on public.property_amenities for update to authenticated using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid()))) with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "Owners delete property amenities" on public.property_amenities for delete to authenticated using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

create policy "Property images are public" on public.property_images for select to anon, authenticated using (true);
create policy "Owners insert property images" on public.property_images for insert to authenticated with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "Owners update property images" on public.property_images for update to authenticated using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid()))) with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "Owners delete property images" on public.property_images for delete to authenticated using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

create policy "Users read own favorites" on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own favorites" on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete own favorites" on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Inquiry participants can read" on public.inquiries for select to authenticated using ((select auth.uid()) = tenant_id or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));
create policy "Tenants create own inquiries" on public.inquiries for insert to authenticated with check ((select auth.uid()) = tenant_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'tenant'));
create policy "Owners update inquiry status" on public.inquiries for update to authenticated using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid()))) with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = (select auth.uid())));

create policy "Users read own preferences" on public.tenant_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own preferences" on public.tenant_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own preferences" on public.tenant_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own preferences" on public.tenant_preferences for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own requirements" on public.tenant_requirements for select to authenticated using ((select auth.uid()) = tenant_id);
create policy "Users insert own requirements" on public.tenant_requirements for insert to authenticated with check ((select auth.uid()) = tenant_id);
create policy "Users update own requirements" on public.tenant_requirements for update to authenticated using ((select auth.uid()) = tenant_id) with check ((select auth.uid()) = tenant_id);
create policy "Users delete own requirements" on public.tenant_requirements for delete to authenticated using ((select auth.uid()) = tenant_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public property images" on storage.objects for select to anon, authenticated using (bucket_id = 'property-images');
create policy "Owners upload to own folder" on storage.objects for insert to authenticated with check (bucket_id = 'property-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners update own images" on storage.objects for update to authenticated using (bucket_id = 'property-images' and owner_id = (select auth.uid())::text) with check (bucket_id = 'property-images' and owner_id = (select auth.uid())::text);
create policy "Owners delete own images" on storage.objects for delete to authenticated using (bucket_id = 'property-images' and owner_id = (select auth.uid())::text);

do $$
begin
  alter publication supabase_realtime add table public.inquiries;
exception when duplicate_object then null;
end $$;
