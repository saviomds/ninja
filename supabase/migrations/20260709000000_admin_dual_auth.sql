-- Dual-auth support tables. These COMPLEMENT Supabase Auth (which still owns
-- the bcrypt password hash + session); they add per-admin password gating,
-- an audit trail, and login rate-limiting. Locked to service_role only.
-- Applied to project wtgfegkfmquwbbvhpbbv on 2026-07-09.

-- Per-admin password-login control + tracking (spec #2, #7)
create table if not exists public.admin_auth_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_enabled boolean not null default false,
  password_updated_at timestamptz,
  last_password_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Security audit trail (spec #10)
create table if not exists public.auth_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  event text not null,
  ip text,
  user_agent text,
  success boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists auth_audit_log_created_at_idx on public.auth_audit_log (created_at desc);
create index if not exists auth_audit_log_email_idx on public.auth_audit_log (email);

-- Login rate-limiting state (spec #9): 5 fails -> 15 min lock
create table if not exists public.auth_login_attempts (
  email text primary key,
  attempts int not null default 0,
  last_ip text,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- RLS on with NO policies => only service_role (bypasses RLS) can access.
alter table public.admin_auth_settings enable row level security;
alter table public.auth_audit_log     enable row level security;
alter table public.auth_login_attempts enable row level security;

-- Backfill: existing admins who already have a password keep password login on,
-- so their current password sign-in never regresses (spec #6).
insert into public.admin_auth_settings (user_id, password_enabled, password_updated_at)
select id, true, now()
from auth.users
where (raw_app_meta_data->>'role' = 'admin' or raw_user_meta_data->>'role' = 'admin')
  and encrypted_password is not null and encrypted_password <> ''
on conflict (user_id) do update set password_enabled = true, updated_at = now();
