-- Compatibility migration for the existing bigint-ID RoomMatch project.
-- Preserves existing accounts, listings, and existing row security policies.
begin;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists last_sign_in_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz default now();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,name,role,email,last_sign_in_at)
  values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'RoomMatch user'),
    case when new.raw_user_meta_data->>'role'='owner' then 'owner' else 'tenant' end,
    new.email,new.last_sign_in_at);
  return new;
end $$;

create or replace function public.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email=new.email,last_sign_in_at=new.last_sign_in_at,updated_at=now() where id=new.id;
  return new;
end $$;
create or replace trigger roommatch_auth_profile_sync after update of email,last_sign_in_at
on auth.users for each row execute function public.sync_auth_profile();
revoke execute on function public.handle_new_user(),public.sync_auth_profile() from public,anon,authenticated;
update public.profiles p set email=u.email,last_sign_in_at=u.last_sign_in_at from auth.users u where p.id=u.id;
-- Profiles stay private under the existing own-profile SELECT policy.
revoke update on public.profiles from authenticated;
grant update(name) on public.profiles to authenticated;

alter table public.properties
  add column if not exists address text not null default '',
  add column if not exists zip_code text not null default '',
  add column if not exists landmark text,
  add column if not exists number_of_rooms smallint not null default 1 check(number_of_rooms>0),
  add column if not exists maintenance numeric(12,2) not null default 0 check(maintenance>=0),
  add column if not exists electricity_charge numeric(12,2) not null default 0 check(electricity_charge>=0),
  add column if not exists water_charge numeric(12,2) not null default 0 check(water_charge>=0);
alter table public.inquiries add column if not exists contact_preference text not null default 'In-app chat';
update public.inquiries set contact_preference=contact_pref where contact_pref is not null;

-- Both legacy Title Case values and current lowercase values remain valid.
do $$ declare c record; begin
  for c in select conname,conrelid::regclass as tbl from pg_constraint
    where conrelid in ('public.properties'::regclass,'public.inquiries'::regclass)
    and contype='c' and pg_get_constraintdef(oid) like '%status%'
  loop execute format('alter table %s drop constraint %I',c.tbl,c.conname); end loop;
end $$;
alter table public.properties add constraint roommatch_property_status check(lower(status) in ('available','rented'));
alter table public.inquiries add constraint roommatch_inquiry_status check(lower(status) in ('sent','viewed','responded','closed'));
alter table public.inquiries alter column status set default 'sent';

create table if not exists public.property_preferences (
 property_id bigint primary key references public.properties(id) on delete cascade,
 students boolean not null default false,bachelors boolean not null default false,
 working_professionals boolean not null default false,families boolean not null default false,
 senior_citizens boolean not null default false,anyone boolean not null default false,
 gender_preference text not null default 'Any',pets_allowed boolean not null default false,
 smoking_allowed boolean not null default false,food_restrictions text not null default 'No preference',
 check(students or bachelors or working_professionals or families or senior_citizens or anyone)
);
create table if not exists public.property_amenities (
 property_id bigint primary key references public.properties(id) on delete cascade,
 wifi boolean not null default false,parking boolean not null default false,
 attached_bathroom boolean not null default false,ac boolean not null default false,
 kitchen boolean not null default false,washing_machine boolean not null default false,
 power_backup boolean not null default false,furnishing text not null default 'Unfurnished'
);
create table if not exists public.property_images (
 id uuid primary key default gen_random_uuid(),
 property_id bigint not null references public.properties(id) on delete cascade,
 image_url text not null,storage_path text,is_primary boolean not null default false,created_at timestamptz not null default now()
);
create unique index if not exists one_primary_image_per_property on public.property_images(property_id) where is_primary;
create table if not exists public.tenant_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 preferred_city text,preferred_locality text,min_budget numeric(12,2) not null default 0 check(min_budget>=0),
 max_budget numeric(12,2) not null default 5000 check(max_budget>0 and max_budget>=min_budget),
 property_type text,tenant_type text,furnishing text,required_amenities text[] not null default '{}',
 pets_required boolean not null default false,food_preference text not null default 'No preference',updated_at timestamptz not null default now()
);
insert into public.property_preferences(property_id,students,bachelors,working_professionals,families,senior_citizens,anyone)
 select id,'Students'=any(suitable_for),suitable_for && array['Individuals','Singles','Bachelors'],
 'Working Professionals'=any(suitable_for),'Families'=any(suitable_for),
 suitable_for && array['Seniors','Senior Citizens'],
 'Anyone'=any(suitable_for) or cardinality(suitable_for)=0 from public.properties
 on conflict(property_id) do nothing;
insert into public.property_amenities(property_id,wifi,parking,attached_bathroom,ac,kitchen,washing_machine,power_backup,furnishing)
 select id,amenities && array['WiFi','Wi-Fi'],'Parking'=any(amenities),amenities && array['Attached Bathroom','Private Bathroom'],
 amenities && array['AC','Air Conditioning'],'Kitchen'=any(amenities),amenities && array['Washing Machine','In-unit Laundry'],
 amenities && array['Power Backup','Utilities Included'],case furnishing when 'Fully Furnished' then 'Furnished' when 'Semi Furnished' then 'Partially Furnished' else coalesce(furnishing,'Unfurnished') end
 from public.properties on conflict(property_id) do nothing;

alter table public.property_preferences enable row level security;
alter table public.property_amenities enable row level security;
alter table public.property_images enable row level security;
alter table public.tenant_preferences enable row level security;
grant select on public.property_preferences,public.property_amenities,public.property_images to anon,authenticated;
grant insert,update,delete on public.property_preferences,public.property_amenities,public.property_images to authenticated;
grant select,insert,update,delete on public.tenant_preferences to authenticated;
do $$ declare t text; begin
 foreach t in array array['property_preferences','property_amenities','property_images'] loop
 execute format('create policy "Marketplace read" on public.%I for select to anon,authenticated using(true)',t);
 execute format('create policy "Owner writes" on public.%I for all to authenticated using(exists(select 1 from public.properties p where p.id=property_id and p.owner_id=(select auth.uid()))) with check(exists(select 1 from public.properties p where p.id=property_id and p.owner_id=(select auth.uid())))',t);
 end loop;
end $$;
create policy "Own preferences" on public.tenant_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke update on public.inquiries from authenticated;
grant update(status) on public.inquiries to authenticated;
notify pgrst,'reload schema';
commit;
