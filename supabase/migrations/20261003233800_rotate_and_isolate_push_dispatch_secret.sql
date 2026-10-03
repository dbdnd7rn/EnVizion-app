create or replace function public.verify_push_dispatch_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from private.push_dispatch_config
    where id = true
      and extensions.digest(candidate, 'sha256') =
          extensions.digest(cron_secret, 'sha256')
  );
$function$;

revoke all on function public.verify_push_dispatch_secret(text) from public;
revoke all on function public.verify_push_dispatch_secret(text) from anon;
revoke all on function public.verify_push_dispatch_secret(text) from authenticated;
grant execute on function public.verify_push_dispatch_secret(text) to service_role;

update private.push_dispatch_config
set cron_secret = encode(extensions.gen_random_bytes(32), 'hex')
where id = true;
