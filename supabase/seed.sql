-- Optional U.S. demo seed.
-- Create an Owner account through the app first, then run this file once.
do $$
declare
  demo_owner uuid;
  demo_property uuid;
begin
  select id into demo_owner from public.profiles where role = 'owner' order by created_at limit 1;
  if demo_owner is null then
    raise notice 'Create an owner account in RoomMatch before running the seed.';
    return;
  end if;

  select id into demo_property from public.properties where owner_id = demo_owner and title = 'Bright student room near UCM';
  if demo_property is null then
    insert into public.properties (owner_id, title, description, address, city, state, zip_code, locality, landmark, property_type, number_of_rooms, rent, deposit, maintenance, available_from)
    values (demo_owner, 'Bright student room near UCM', 'A quiet, sunny private room with fast Wi-Fi and a dedicated study area.', '1200 Magnolia Lane', 'Warrensburg', 'MO', '64093', 'UCM Campus District', 'Near the UCM campus', 'Private Room', 1, 650, 500, 0, current_date + 7)
    returning id into demo_property;

    insert into public.property_preferences (property_id, students, gender_preference, pets_allowed, smoking_allowed, food_restrictions)
    values (demo_property, true, 'Any', false, false, 'No preference');

    insert into public.property_amenities (property_id, wifi, attached_bathroom, power_backup, furnishing)
    values (demo_property, true, true, true, 'Partially Furnished');
  end if;
end $$;
