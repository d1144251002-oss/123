-- Improve deletion cascades and owner dashboard lookups.
create index if not exists evq_events_owner_idx on public.evq_events(owner_id);
create index if not exists evq_answers_participant_idx on public.evq_answers(participant_id);
