-- Web-push subscriptions.
--
-- RUN THIS IN THE EMPLOYEE PORTAL PROJECT (the app's own Supabase project —
-- NOT the Pharma/Nursing project).
--
-- Each row is one browser/device that agreed to receive notifications. Rows are
-- readable and writable only by their owner, so the app never needs a
-- service-role key to send an alert: it pushes to the signed-in user's devices.
-- Safe to run more than once.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text,
  auth text,
  user_agent text,
  app_url text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- One policy for everything: a user may only touch their own devices.
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
