-- HomeOS account-based households (STAGED; do not run without backup + owner sign-off).
-- Additive migration. Existing token households continue working until the owner explicitly claims one.
-- All household state remains in homeos_households_v2.data, preserving its revision and history.

create table if not exists public.homeos_account_members (
 household_id uuid not null references public.homeos_households_v2(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','member')),
 display_name text not null default '',
 joined_at timestamptz not null default now(),
 primary key(household_id,user_id)
);
create unique index if not exists homeos_account_single_owner
 on public.homeos_account_members(household_id) where role='owner';
create index if not exists homeos_account_by_user
 on public.homeos_account_members(user_id,joined_at);

create table if not exists public.homeos_account_invites (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.homeos_households_v2(id) on delete cascade,
 token_hash text not null unique,
 created_by uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 accepted_by uuid references auth.users(id),
 redeemed_at timestamptz,
 revoked_at timestamptz,
 check(expires_at > created_at)
);
create index if not exists homeos_account_invites_household
 on public.homeos_account_invites(household_id,expires_at);

alter table public.homeos_account_members enable row level security;
alter table public.homeos_account_invites enable row level security;
-- No direct table access: only SECURITY DEFINER RPCs below, which always check auth.uid().
revoke all on public.homeos_account_members from public,anon,authenticated;
revoke all on public.homeos_account_invites from public,anon,authenticated;

create or replace function public.homeos_account_mine()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid := auth.uid();
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 return jsonb_build_object('ok',true,'households',coalesce((
  select jsonb_agg(jsonb_build_object(
   'householdId',m.household_id,'name',h.name,'role',m.role,'memberName',m.display_name,'revision',h.revision
  ) order by m.joined_at,h.name)
  from public.homeos_account_members m
  join public.homeos_households_v2 h on h.id=m.household_id
  where m.user_id=uid
 ),'[]'::jsonb));
end; $$;

create or replace function public.homeos_account_household_create(
 p_name text,p_data jsonb,p_display_name text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid := auth.uid(); hid uuid; ver bigint;
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 if pg_column_size(coalesce(p_data,'{}'::jsonb))>1048576 then
  return jsonb_build_object('ok',false,'error','state_too_large');
 end if;
 -- Legacy token column is required, but this random secret is never returned.
 insert into public.homeos_households_v2(name,access_token_hash,data)
 values (left(coalesce(nullif(btrim(p_name),''),'Mi hogar'),80),
         encode(extensions.digest(extensions.gen_random_bytes(32),'sha256'),'hex'),
         coalesce(p_data,'{}'::jsonb))
 returning id,revision into hid,ver;
 insert into public.homeos_account_members(household_id,user_id,role,display_name)
 values(hid,uid,'owner',left(btrim(coalesce(p_display_name,'')),60));
 return jsonb_build_object('ok',true,'householdId',hid,'revision',ver);
end; $$;

create or replace function public.homeos_account_household_claim(
 p_household_id uuid,p_legacy_token text,p_display_name text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid := auth.uid(); hid uuid; ver bigint;
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 if char_length(coalesce(p_legacy_token,''))<32 then
  return jsonb_build_object('ok',false,'error','invalid_code');
 end if;
 select id,revision into hid,ver
 from public.homeos_households_v2
 where id=p_household_id
 and access_token_hash=encode(extensions.digest(p_legacy_token,'sha256'),'hex')
 for update;
 if not found then return jsonb_build_object('ok',false,'error','invalid_code');end if;
 if exists(select 1 from public.homeos_account_members where household_id=hid) then
  return jsonb_build_object('ok',false,'error','already_claimed');
 end if;
 insert into public.homeos_account_members(household_id,user_id,role,display_name)
 values(hid,uid,'owner',left(btrim(coalesce(p_display_name,'')),60));
 -- Rotate the inaccessible legacy credential; claimed houses can no longer use HOS1 RPC.
 update public.homeos_households_v2
 set access_token_hash=encode(extensions.digest(extensions.gen_random_bytes(32),'sha256'),'hex')
 where id=hid;
 return jsonb_build_object('ok',true,'householdId',hid,'revision',ver);
end; $$;

create or replace function public.homeos_account_household_read(p_household_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid := auth.uid(); row_data record;
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 select h.name,h.data,h.revision,h.updated_at,m.role into row_data
 from public.homeos_account_members m
 join public.homeos_households_v2 h on h.id=m.household_id
 where m.household_id=p_household_id and m.user_id=uid;
 if not found then return jsonb_build_object('ok',false,'error','not_member');end if;
 return jsonb_build_object('ok',true,'name',row_data.name,'data',row_data.data,
                           'revision',row_data.revision,'updatedAt',row_data.updated_at,'role',row_data.role);
end; $$;

create or replace function public.homeos_account_household_write_v2(
 p_household_id uuid,p_expected_revision bigint,p_data jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid := auth.uid(); next_revision bigint; current_revision bigint;
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 if pg_column_size(coalesce(p_data,'{}'::jsonb))>1048576 then
  return jsonb_build_object('ok',false,'error','state_too_large');
 end if;
 -- Hold the membership lock until the write commits. Revocation cannot race a permitted write.
 perform 1 from public.homeos_account_members
 where household_id=p_household_id and user_id=uid for share;
 if not found then return jsonb_build_object('ok',false,'error','not_member');end if;
 update public.homeos_households_v2 set data=coalesce(p_data,'{}'::jsonb),
   revision=revision+1,updated_at=now()
 where id=p_household_id and revision=p_expected_revision
 returning revision into next_revision;
 if found then return jsonb_build_object('ok',true,'revision',next_revision);end if;
 select revision into current_revision from public.homeos_households_v2 where id=p_household_id;
 return jsonb_build_object('ok',false,'error','conflict','revision',current_revision);
end; $$;

create or replace function public.homeos_account_invite_create(p_household_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); token text; invite_id uuid;
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 if not exists(select 1 from public.homeos_account_members where household_id=p_household_id
               and user_id=uid and role='owner') then
  return jsonb_build_object('ok',false,'error','not_owner');
 end if;
 if (select count(*) from public.homeos_account_members where household_id=p_household_id)>=12 then
  return jsonb_build_object('ok',false,'error','household_full');
 end if;
 if (select count(*) from public.homeos_account_invites
     where household_id=p_household_id and expires_at>now() and redeemed_at is null and revoked_at is null)>=12 then
  return jsonb_build_object('ok',false,'error','too_many_invites');
 end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.homeos_account_invites(household_id,token_hash,created_by,expires_at)
 values(p_household_id,encode(extensions.digest(token,'sha256'),'hex'),uid,now()+interval '48 hours')
 returning id into invite_id;
 return jsonb_build_object('ok',true,'code','HOS2.'||p_household_id||'.'||token,
                           'inviteId',invite_id,'expiresInHours',48);
end; $$;

create or replace function public.homeos_account_invite_redeem(
 p_code text,p_display_name text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); fragments text[]; hid uuid; token text; invite_row record;
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 fragments:=string_to_array(btrim(coalesce(p_code,'')),'.');
 if array_length(fragments,1)<>3 or fragments[1]<>'HOS2' or
    fragments[2]!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or
    fragments[3]!~'^[0-9a-f]{64}$' then
  return jsonb_build_object('ok',false,'error','invalid_code');
 end if;
 hid:=fragments[2]::uuid; token:=fragments[3];
 -- Serialize redemption by locking the invitation and household to avoid overbooking.
 select h.id as home_id,i.id as invite_id,i.accepted_by into invite_row
 from public.homeos_account_invites i
 join public.homeos_households_v2 h on h.id=i.household_id
 where i.household_id=hid and
       i.token_hash=encode(extensions.digest(token,'sha256'),'hex') and
       i.expires_at>now() and i.revoked_at is null
 for update of h,i;
 if not found then return jsonb_build_object('ok',false,'error','invalid_or_expired');end if;
 if invite_row.accepted_by=uid then
  if exists(select 1 from public.homeos_account_members where household_id=hid and user_id=uid) then
   return jsonb_build_object('ok',true,'householdId',hid,'alreadyJoined',true);
  end if;
  return jsonb_build_object('ok',false,'error','invite_used');
 end if;
 if invite_row.accepted_by is not null then
  return jsonb_build_object('ok',false,'error','invite_used');
 end if;
 if (select count(*) from public.homeos_account_members where household_id=hid)>=12 then
  return jsonb_build_object('ok',false,'error','household_full');
 end if;
 insert into public.homeos_account_members(household_id,user_id,role,display_name)
 values(hid,uid,'member',left(btrim(coalesce(p_display_name,'')),60))
 on conflict(household_id,user_id) do nothing;
 update public.homeos_account_invites set accepted_by=uid,redeemed_at=now()
 where id=invite_row.invite_id;
 return jsonb_build_object('ok',true,'householdId',hid);
end; $$;

create or replace function public.homeos_account_members_list(p_household_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 if not exists(select 1 from public.homeos_account_members where household_id=p_household_id and user_id=uid)
 then return jsonb_build_object('ok',false,'error','not_member');end if;
 return jsonb_build_object('ok',true,'members',coalesce((
  select jsonb_agg(jsonb_build_object('userId',user_id,'name',display_name,'role',role,'joinedAt',joined_at)
                   order by joined_at)
  from public.homeos_account_members where household_id=p_household_id
 ),'[]'::jsonb));
end; $$;

create or replace function public.homeos_account_member_remove(p_household_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 if not exists(select 1 from public.homeos_account_members where household_id=p_household_id
               and user_id=uid and role='owner') then
  return jsonb_build_object('ok',false,'error','not_owner');
 end if;
 if p_user_id=uid then return jsonb_build_object('ok',false,'error','cannot_remove_owner');end if;
 delete from public.homeos_account_members where household_id=p_household_id
 and user_id=p_user_id and role='member';
 return jsonb_build_object('ok',true,'removed',found);
end; $$;

create or replace function public.homeos_account_leave(p_household_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then return jsonb_build_object('ok',false,'error','auth_required');end if;
 if exists(select 1 from public.homeos_account_members where household_id=p_household_id
           and user_id=uid and role='owner') then
  return jsonb_build_object('ok',false,'error','owner_must_transfer_first');
 end if;
 delete from public.homeos_account_members where household_id=p_household_id and user_id=uid;
 return jsonb_build_object('ok',true,'removed',found);
end; $$;

-- PostgreSQL functions are PUBLIC-executable by default. Do not leave that default.
revoke all on function public.homeos_account_mine() from public,anon;
revoke all on function public.homeos_account_household_create(text,jsonb,text) from public,anon;
revoke all on function public.homeos_account_household_claim(uuid,text,text) from public,anon;
revoke all on function public.homeos_account_household_read(uuid) from public,anon;
revoke all on function public.homeos_account_household_write_v2(uuid,bigint,jsonb) from public,anon;
revoke all on function public.homeos_account_invite_create(uuid) from public,anon;
revoke all on function public.homeos_account_invite_redeem(text,text) from public,anon;
revoke all on function public.homeos_account_members_list(uuid) from public,anon;
revoke all on function public.homeos_account_member_remove(uuid,uuid) from public,anon;
revoke all on function public.homeos_account_leave(uuid) from public,anon;
grant execute on function public.homeos_account_mine() to authenticated;
grant execute on function public.homeos_account_household_create(text,jsonb,text) to authenticated;
grant execute on function public.homeos_account_household_claim(uuid,text,text) to authenticated;
grant execute on function public.homeos_account_household_read(uuid) to authenticated;
grant execute on function public.homeos_account_household_write_v2(uuid,bigint,jsonb) to authenticated;
grant execute on function public.homeos_account_invite_create(uuid) to authenticated;
grant execute on function public.homeos_account_invite_redeem(text,text) to authenticated;
grant execute on function public.homeos_account_members_list(uuid) to authenticated;
grant execute on function public.homeos_account_member_remove(uuid,uuid) to authenticated;
grant execute on function public.homeos_account_leave(uuid) to authenticated;
