
-- Aggregation on the server avoids downloading participant response identities to the browser.
create function public.evq_host_statistics(p_event_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare v_total integer; v_questions jsonb;
begin
 if not exists (select 1 from public.evq_events where id=p_event_id and owner_id=auth.uid()) then
   raise exception '無權限讀取此活動';
 end if;
 select count(*) into v_total from public.evq_participants p where p.event_id=p_event_id;
 select coalesce(jsonb_object_agg(q.id::text, jsonb_build_object(
   'total', (select count(*) from public.evq_answers a where a.question_id=q.id),
   'counts', (select jsonb_agg(
     (select count(*) from public.evq_answers a where a.question_id=q.id and a.choice=i)
     order by i
   ) from pg_catalog.generate_series(0,jsonb_array_length(q.options)-1) as i)
 )), '{}'::jsonb) into v_questions
 from public.evq_questions q where q.event_id=p_event_id;
 return jsonb_build_object('participants',v_total,'questions',v_questions);
end $$;
revoke execute on function public.evq_host_statistics(uuid) from public, anon, authenticated;
grant execute on function public.evq_host_statistics(uuid) to authenticated;
