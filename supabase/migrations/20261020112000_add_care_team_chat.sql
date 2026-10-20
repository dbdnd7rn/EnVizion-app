
-- Private, membership-revalidated per-recipient chat. Never store medical message bodies in notifications.
create table public.chat_conversations (
 id uuid primary key default gen_random_uuid(),
 care_recipient_id uuid not null references public.care_recipients(id) on delete cascade,
 kind text not null check (kind in ('group','direct')),
 direct_user_a uuid references auth.users(id) on delete cascade,
 direct_user_b uuid references auth.users(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 constraint chat_direct_shape check (
   (kind='group' and direct_user_a is null and direct_user_b is null)
   or (kind='direct' and direct_user_a is not null and direct_user_b is not null and direct_user_a < direct_user_b)
 )
);
create unique index chat_group_unique on public.chat_conversations(care_recipient_id) where kind='group';
create unique index chat_direct_unique on public.chat_conversations(care_recipient_id,direct_user_a,direct_user_b) where kind='direct';
create index chat_conversations_recipient_created on public.chat_conversations(care_recipient_id,created_at desc);

create table public.chat_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id),
 body text,
 reply_to uuid references public.chat_messages(id) on delete set null,
 client_nonce text not null check (length(client_nonce) between 18 and 100),
 created_at timestamptz not null default now(),
 edited_at timestamptz,
 deleted_at timestamptz,
 constraint chat_message_body_valid check (
   (deleted_at is null and body is not null and length(btrim(body)) between 1 and 2000)
   or (deleted_at is not null and body is null)
 )
);
create unique index chat_message_idempotent on public.chat_messages(sender_id,client_nonce);
create index chat_messages_page on public.chat_messages(conversation_id,created_at desc,id desc);
create index chat_messages_reply on public.chat_messages(reply_to) where reply_to is not null;

create table public.chat_read_state (
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_at timestamptz not null default now(),
 primary key (conversation_id,user_id)
);
create index chat_read_state_user on public.chat_read_state(user_id);

create table public.chat_typing_state (
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 typed_at timestamptz not null default now(),
 primary key (conversation_id,user_id)
);
create index chat_typing_state_conversation on public.chat_typing_state(conversation_id,typed_at desc);

create table private.chat_message_audit (
 id bigint generated always as identity primary key,
 message_id uuid not null references public.chat_messages(id) on delete cascade,
 actor_id uuid not null,
 event_type text not null check (event_type in ('edited','deleted')),
 occurred_at timestamptz not null default now()
);
revoke all on private.chat_message_audit from public, anon, authenticated;
alter table private.chat_message_audit enable row level security;

-- User-independent membership check is internal only and never exposed via the Data API.
create function private.chat_is_member(target_recipient uuid, target_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.care_recipients r
               where r.id=target_recipient and r.owner_id=target_user)
 or exists(select 1 from public.care_recipient_members m
           where m.care_recipient_id=target_recipient and m.user_id=target_user and m.status='active')
 or exists(select 1 from public.care_recipients r
           join public.care_group_members gm on gm.care_group_id=r.care_group_id
           where r.id=target_recipient and gm.user_id=target_user and gm.status='active');
$$;
revoke all on function private.chat_is_member(uuid,uuid) from public, anon, authenticated;

-- RLS checks current care membership on every query; no cached JWT roles.
create function private.chat_can_access(target_conversation uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists (
   select 1 from public.chat_conversations c where c.id=target_conversation
     and private.can_view_care_recipient(c.care_recipient_id)
     and (c.kind='group' or (select auth.uid()) in (c.direct_user_a,c.direct_user_b))
 );
$$;
revoke all on function private.chat_can_access(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.chat_can_access(uuid) to authenticated;

create function public.chat_open_conversation(p_recipient uuid,p_peer uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; actor uuid := (select auth.uid()); a uuid; b uuid;
begin
 if actor is null or not private.chat_is_member(p_recipient,actor) then
   raise exception 'Care team access required' using errcode='42501';
 end if;
 if p_peer is null then
   insert into public.chat_conversations(care_recipient_id,kind,created_by)
   values(p_recipient,'group',actor)
   on conflict(care_recipient_id) where kind='group'
   do update set care_recipient_id=excluded.care_recipient_id
   returning id into cid;
 else
   if p_peer=actor or not private.chat_is_member(p_recipient,p_peer) then
     raise exception 'Caregiver not authorized' using errcode='42501';
   end if;
   a:=least(actor,p_peer); b:=greatest(actor,p_peer);
   insert into public.chat_conversations(care_recipient_id,kind,direct_user_a,direct_user_b,created_by)
   values(p_recipient,'direct',a,b,actor)
   on conflict(care_recipient_id,direct_user_a,direct_user_b) where kind='direct'
   do update set care_recipient_id=excluded.care_recipient_id
   returning id into cid;
 end if;
 return cid;
end;$$;
revoke all on function public.chat_open_conversation(uuid,uuid) from public, anon;
grant execute on function public.chat_open_conversation(uuid,uuid) to authenticated;

create function public.chat_team_people(p_recipient uuid)
returns table(user_id uuid, full_name text, avatar_url text)
language sql stable security definer set search_path='' as $$
 with allowed as (
  select r.owner_id uid from public.care_recipients r where r.id=p_recipient
  union
  select m.user_id from public.care_recipient_members m
   where m.care_recipient_id=p_recipient and m.status='active'
  union
  select gm.user_id from public.care_recipients r
   join public.care_group_members gm on gm.care_group_id=r.care_group_id
   where r.id=p_recipient and gm.status='active'
 )
 select a.uid, p.full_name, p.avatar_url from allowed a
 left join public.profiles p on p.id=a.uid
 where (select auth.uid()) is not null
  and private.can_view_care_recipient(p_recipient)
 order by p.full_name nulls last, a.uid;
$$;
revoke all on function public.chat_team_people(uuid) from public, anon;
grant execute on function public.chat_team_people(uuid) to authenticated;

create function public.chat_mark_read(p_conversation uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.chat_can_access(p_conversation) then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.chat_read_state(conversation_id,user_id,last_read_at)
 values(p_conversation,(select auth.uid()),now())
 on conflict(conversation_id,user_id) do update set last_read_at=greatest(
   public.chat_read_state.last_read_at,excluded.last_read_at);
end;$$;
revoke all on function public.chat_mark_read(uuid) from public, anon;
grant execute on function public.chat_mark_read(uuid) to authenticated;

create function public.chat_signal_typing(p_conversation uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.chat_can_access(p_conversation) then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.chat_typing_state(conversation_id,user_id,typed_at)
 values(p_conversation,(select auth.uid()),now())
 on conflict(conversation_id,user_id) do update set typed_at=excluded.typed_at;
end;$$;
revoke all on function public.chat_signal_typing(uuid) from public, anon;
grant execute on function public.chat_signal_typing(uuid) to authenticated;

create function private.chat_before_message_insert()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.reply_to is not null and not exists(
  select 1 from public.chat_messages m where m.id=new.reply_to
    and m.conversation_id=new.conversation_id and m.deleted_at is null
 ) then raise exception 'Reply target not found in conversation' using errcode='23514'; end if;
 return new;
end;$$;
create trigger chat_reply_same_conversation before insert on public.chat_messages
for each row execute function private.chat_before_message_insert();

create function private.chat_audit_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deleted_at is distinct from old.deleted_at then
  insert into private.chat_message_audit(message_id,actor_id,event_type)
  values(old.id,(select auth.uid()),'deleted');
 elsif new.body is distinct from old.body then
  insert into private.chat_message_audit(message_id,actor_id,event_type)
  values(old.id,(select auth.uid()),'edited');
 end if;
 return new;
end;$$;
create trigger chat_track_revisions after update on public.chat_messages
for each row execute function private.chat_audit_message();

create function private.chat_notify_new_message()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(user_id,audience,kind,title,body,entity_type,entity_id)
 select eligible.uid,'caregiver','care_chat_message','New care team message',
        'Open EnVizion Life to read a private message.','care_chat',new.conversation_id
 from public.chat_conversations c
 cross join lateral (
  select r.owner_id uid from public.care_recipients r where r.id=c.care_recipient_id
  union
  select m.user_id from public.care_recipient_members m where m.care_recipient_id=c.care_recipient_id and m.status='active'
  union
  select gm.user_id from public.care_recipients r join public.care_group_members gm on gm.care_group_id=r.care_group_id
  where r.id=c.care_recipient_id and gm.status='active'
 ) eligible
 where c.id=new.conversation_id and eligible.uid<>new.sender_id
 and (c.kind='group' or eligible.uid in(c.direct_user_a,c.direct_user_b))
 and private.chat_is_member(c.care_recipient_id,eligible.uid);
 return new;
end;$$;
create trigger chat_new_message_notification after insert on public.chat_messages
for each row execute function private.chat_notify_new_message();

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_read_state enable row level security;
alter table public.chat_typing_state enable row level security;

create policy chat_conversations_read on public.chat_conversations for select to authenticated
 using(private.chat_can_access(id));
create policy chat_messages_read on public.chat_messages for select to authenticated
 using(private.chat_can_access(conversation_id));
create policy chat_messages_write on public.chat_messages for insert to authenticated
 with check(sender_id=(select auth.uid()) and private.chat_can_access(conversation_id));
create policy chat_messages_own_edit on public.chat_messages for update to authenticated
 using(sender_id=(select auth.uid()) and deleted_at is null and private.chat_can_access(conversation_id))
 with check(sender_id=(select auth.uid()) and private.chat_can_access(conversation_id));
create policy chat_reads_view on public.chat_read_state for select to authenticated
 using(private.chat_can_access(conversation_id));
create policy chat_typing_view on public.chat_typing_state for select to authenticated
 using(private.chat_can_access(conversation_id));

revoke all on public.chat_conversations,public.chat_messages,public.chat_read_state,public.chat_typing_state from public,anon,authenticated;
grant select on public.chat_conversations to authenticated;
grant select,insert on public.chat_messages to authenticated;
grant update(body,edited_at,deleted_at) on public.chat_messages to authenticated;
grant select on public.chat_read_state,public.chat_typing_state to authenticated;

alter publication supabase_realtime add table public.chat_conversations;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_read_state;
alter publication supabase_realtime add table public.chat_typing_state;
