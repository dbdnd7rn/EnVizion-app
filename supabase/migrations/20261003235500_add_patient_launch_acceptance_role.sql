alter table public.pilot_acceptance_runs
  drop constraint if exists pilot_acceptance_runs_role_check;

alter table public.pilot_acceptance_runs
  add constraint pilot_acceptance_runs_role_check
  check (role = any (array['owner'::text, 'caregiver'::text, 'patient'::text, 'viewer'::text]));
