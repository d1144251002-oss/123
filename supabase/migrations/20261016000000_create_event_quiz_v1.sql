
-- 活動即時問答 V1。獨立 evq_ 命名空間，不修改其他系統。
create table if not exists public.evq_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  status text not null default 'draft' check (status in ('draft','open','closed')),
  show_results boolean not null default false,
  created_at timestamptz not null default now(),
  constraint evq_code_format check (code ~ '^[A-Z0-9]{6,8}$')
);
create table if not exists public.evq_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.evq_events(id) on delete cascade,
  position integer not null check (position between 1 and 100),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 500),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_index integer not null check (correct_index between 0 and 5 and correct_index < jsonb_array_length(options)),
  status text not null default 'draft' check (status in ('draft','open','closed')),
  created_at timestamptz not null default now(),
  unique(event_id, position)
);
create unique index if not exists evq_one_open_question on public.evq_questions (event_id) where status = 'open';
create table if not exists public.evq_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.evq_events(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  token_hash text not null check (char_length(token_hash) = 64),
  joined_at timestamptz not null default now(),
  unique(event_id, token_hash),
  unique(id, event_id)
);
create table if not exists public.evq_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.evq_questions(id) on delete cascade,
  participant_id uuid not null references public.evq_participants(id) on delete cascade,
  choice integer not null check (choice between 0 and 5),
  created_at timestamptz not null default now(),
  unique(question_id, participant_id)
);
create index if not exists evq_question_answers_idx on public.evq_answers(question_id, choice);
create index if not exists evq_participants_event_idx on public.evq_participants(event_id);
create index if not exists evq_questions_event_idx on public.evq_questions(event_id, position);

alter table public.evq_events enable row level security;
alter table public.evq_questions enable row level security;
alter table public.evq_participants enable row level security;
alter table public.evq_answers enable row level security;

create policy evq_owner_events_select on public.evq_events for select to authenticated using (owner_id = (select auth.uid()));
create policy evq_owner_events_insert on public.evq_events for insert to authenticated with check (owner_id = (select auth.uid()));
create policy evq_owner_events_update on public.evq_events for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy evq_owner_events_delete on public.evq_events for delete to authenticated using (owner_id = (select auth.uid()));
create policy evq_owner_questions_select on public.evq_questions for select to authenticated using (exists (select 1 from public.evq_events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy evq_owner_questions_insert on public.evq_questions for insert to authenticated with check (exists (select 1 from public.evq_events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy evq_owner_questions_update on public.evq_questions for update to authenticated using (exists (select 1 from public.evq_events e where e.id = event_id and e.owner_id = (select auth.uid()))) with check (exists (select 1 from public.evq_events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy evq_owner_questions_delete on public.evq_questions for delete to authenticated using (exists (select 1 from public.evq_events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy evq_owner_participants_select on public.evq_participants for select to authenticated using (exists (select 1 from public.evq_events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy evq_owner_answers_select on public.evq_answers for select to authenticated using (exists (select 1 from public.evq_questions q join public.evq_events e on e.id = q.event_id where q.id = question_id and e.owner_id = (select auth.uid())));

-- Newer Supabase projects require explicit Data API grants in addition to RLS.
revoke all on public.evq_events, public.evq_questions, public.evq_participants, public.evq_answers from anon;
grant select, insert, update, delete on public.evq_events, public.evq_questions to authenticated;
grant select on public.evq_participants, public.evq_answers to authenticated;

-- Guest credentials are 122-bit random UUIDs generated in the browser.
-- They are hashed at rest and validated inside narrow, audited RPC entrypoints.
create function public.evq_join(p_code text, p_name text, p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_event public.evq_events%rowtype; v_user public.evq_participants%rowtype; v_hash text;
begin
  if p_token is null or p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception '無效的裝置識別碼';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then
    raise exception '請輸入 1 到 40 字的暱稱';
  end if;
  select * into v_event from public.evq_events
  where code = upper(btrim(coalesce(p_code,''))) and status = 'open';
  if not found then raise exception '活動不存在或尚未開放'; end if;
  v_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
  if not exists (select 1 from public.evq_participants where event_id = v_event.id and token_hash = v_hash)
     and (select count(*) from public.evq_participants where event_id = v_event.id) >= 2000 then
    raise exception '活動已達參加人數上限';
  end if;
  insert into public.evq_participants(event_id,display_name,token_hash)
  values (v_event.id,btrim(p_name),v_hash)
  on conflict (event_id,token_hash) do update set display_name = excluded.display_name
  returning * into v_user;
  return jsonb_build_object('id',v_user.id,'name',v_user.display_name,'event_id',v_event.id);
end $$;

create function public.evq_guest_state(p_code text, p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_event public.evq_events%rowtype; v_user public.evq_participants%rowtype; v_hash text; v_questions jsonb;
begin
  if p_token is null or p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception '請先加入活動';
  end if;
  select * into v_event from public.evq_events where code = upper(btrim(coalesce(p_code,'')));
  if not found then raise exception '找不到活動'; end if;
  v_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
  select * into v_user from public.evq_participants where event_id = v_event.id and token_hash = v_hash;
  if not found then raise exception '請先加入活動'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'prompt', q.prompt, 'position', q.position,
    'options', q.options, 'status', q.status,
    'my_choice', (select a.choice from public.evq_answers a where a.question_id = q.id and a.participant_id = v_user.id),
    'counts', case when v_event.show_results and q.status='closed' then
      (select jsonb_agg((select count(*) from public.evq_answers a where a.question_id=q.id and a.choice=i) order by i)
       from pg_catalog.generate_series(0, jsonb_array_length(q.options)-1) as i)
      else null end,
    'correct_index', case when v_event.show_results and q.status='closed' then q.correct_index else null end
  ) order by q.position), '[]'::jsonb) into v_questions
  from public.evq_questions q where q.event_id=v_event.id and q.status <> 'draft';
  return jsonb_build_object(
    'event',jsonb_build_object('title',v_event.title,'code',v_event.code,'status',v_event.status,'show_results',v_event.show_results),
    'participant',jsonb_build_object('id',v_user.id,'name',v_user.display_name),
    'questions',v_questions
  );
end $$;

create function public.evq_submit(p_code text, p_token text, p_question_id uuid, p_choice integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_event public.evq_events%rowtype; v_question public.evq_questions%rowtype; v_user public.evq_participants%rowtype; v_choice integer; v_id uuid;
begin
  if p_token is null or p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception '無效的參加者識別碼';
  end if;
  select * into v_event from public.evq_events where code=upper(btrim(coalesce(p_code,''))) for share;
  if not found or v_event.status <> 'open' then raise exception '活動尚未開放或已結束'; end if;
  select * into v_question from public.evq_questions where id=p_question_id and event_id=v_event.id for share;
  if not found or v_question.status <> 'open' then raise exception '本題目前無法作答'; end if;
  if p_choice is null or p_choice < 0 or p_choice >= jsonb_array_length(v_question.options) then
    raise exception '選項超出範圍';
  end if;
  select * into v_user from public.evq_participants
  where event_id=v_event.id and token_hash=encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
  if not found then raise exception '參加者身分失效，請重新加入'; end if;
  insert into public.evq_answers(question_id,participant_id,choice)
  values(v_question.id,v_user.id,p_choice)
  on conflict(question_id,participant_id) do nothing returning id into v_id;
  select choice into v_choice from public.evq_answers where question_id=v_question.id and participant_id=v_user.id;
  return jsonb_build_object('accepted',v_id is not null,'choice',v_choice);
end $$;

create function public.evq_activate_question(p_question_id uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_event uuid;
begin
  select q.event_id into v_event from public.evq_questions q
  join public.evq_events e on e.id=q.event_id
  where q.id=p_question_id and e.owner_id=auth.uid() and e.status='open';
  if v_event is null then raise exception '活動未開放或無管理權限'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_event::text));
  update public.evq_questions set status='closed' where event_id=v_event and status='open';
  update public.evq_questions set status='open' where id=p_question_id and event_id=v_event;
  return true;
end $$;

revoke execute on function public.evq_join(text,text,text) from public, anon, authenticated;
revoke execute on function public.evq_guest_state(text,text) from public, anon, authenticated;
revoke execute on function public.evq_submit(text,text,uuid,integer) from public, anon, authenticated;
revoke execute on function public.evq_activate_question(uuid) from public, anon, authenticated;
grant execute on function public.evq_join(text,text,text), public.evq_guest_state(text,text),
 public.evq_submit(text,text,uuid,integer) to anon, authenticated;
grant execute on function public.evq_activate_question(uuid) to authenticated;
