-- SPEC 04 — Perfiles de jugador ligados a auth.users.

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lectura pública: los rankings necesitan mostrar los nombres.
create policy "profiles_select_public" on public.profiles
  for select using (true);

-- Cada usuario solo puede modificar su propia fila.
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- No hay política de insert: las filas las crea únicamente el trigger.

-- Crea el perfil al registrarse.
-- Toma el username de options.data.username; si no viene (usuario creado a
-- mano en el dashboard), usa la parte local del correo. Se normaliza a
-- mayúsculas y 10 caracteres. Ante colisión, añade 4 caracteres del uuid.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username  text;
  final_username text;
begin
  base_username := upper(
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'username'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'PLAYER'
      ),
      10
    )
  );

  final_username := base_username;

  if exists (select 1 from public.profiles p where p.username = final_username) then
    final_username := left(base_username, 6) || upper(left(new.id::text, 4));
  end if;

  insert into public.profiles (id, username) values (new.id, final_username);

  return new;
end;
$$;

-- La función solo debe ejecutarla el trigger, nunca la API REST
-- (/rest/v1/rpc/handle_new_user). Sin esto el linter de Supabase avisa de
-- una security definer function ejecutable por anon y authenticated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
