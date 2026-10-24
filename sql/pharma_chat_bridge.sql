-- Pharma Chat bridge — cross-project identity support
--
-- RUN THIS IN THE PHARMA / NURSING PROJECT (the shared project that owns
-- `topic_threads` / `topic_messages`, e.g. ayvpdpthxwplbsmhpbva).
-- Do NOT run it in the Employee Portal project.
--
-- Why: `topic_threads.created_by` and `topic_messages.sender_id` are foreign
-- keys to *that* project's `auth.users`. Employee Portal users live in a
-- different Supabase project, so their ids can never satisfy those keys. The
-- bridge therefore writes the Pharma-side user resolved by email, or NULL, and
-- identifies the sender with `sender_side = 'employee'`.
--
-- Safe to run more than once.

-- 1. Allow a NULL creator/sender (cross-project messages have no Pharma account).
alter table public.topic_threads  alter column created_by drop not null;
alter table public.topic_messages alter column sender_id  drop not null;

-- 2. Insurance: the assignee column the bridge writes when a chat is created
--    for a specific pharmacy member.
alter table public.topic_threads
  add column if not exists assigned_user_id uuid;
