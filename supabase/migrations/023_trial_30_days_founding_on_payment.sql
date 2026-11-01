-- File: supabase/migrations/023_trial_30_days_founding_on_payment.sql
-- Your Pool Mate — launch decisions (31 Oct 2026)
-- Run AFTER 022_ask_mate_chat.sql.
--
--   1. Trial wording goes back to 30 days. New signups get signup + 30 days.
--      The site, the app and the terms all say 30 days, so the beta end date
--      from 015 must stop applying to new people.
--   2. Founding places are counted on PAYMENT (first 300 paid members), not
--      on signup order. stripe-checkout now decides the price from the number
--      of profiles with plan = 'founding_lifetime'. The founding_member flag
--      is kept only so L1/L4/L5 can show the founding note: it is now true
--      while the offer is open at signup.
--
-- What this does NOT do:
--   • It does not touch anyone already signed up. Existing members keep the
--     trial_ends_at they have (the 31 Mar 2027 beta date, or a manual date).
--   • It does NOT call set_beta_trial_until(). That function rewrites every
--     non-premium trial to signup + 30 days, which would expire existing
--     testers at once and overwrite any manual date.
--
-- Wind down existing testers later, with notice, only after checking who is
-- on a manual date:
--   select id, trial_ends_at from public.user_profiles order by trial_ends_at desc;

-- ─── 1. Beta end date off for new signups ────────────────────────
-- beta_trial_until() reads this as NULL, and greatest() ignores NULL, so
-- handle_new_user below gives plain now() + 30 days.
update public.app_config
set value = null, updated_at = now()
where key = 'beta_trial_until';

-- ─── 2. New signups: 30 days, founding flag = offer still open ───
-- Same as 015 except the founding flag. It no longer uses signup rank.
-- 300 is the founding cap (also FOUNDING_CAP in _shared/founding.js).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_rank integer;
  v_paid integer;
begin
  select count(*) + 1 into v_rank from public.user_profiles;
  select count(*) into v_paid from public.user_profiles where plan = 'founding_lifetime';

  insert into public.user_profiles (id, trial_ends_at, signup_rank, founding_member)
  values (
    new.id,
    greatest(now() + interval '30 days', public.beta_trial_until()),
    v_rank,
    (v_paid < 300)
  );
  return new;
end;
$$;

-- ─── Verify (run each on its own) ────────────────────────────────
-- 1. select value from public.app_config where key = 'beta_trial_until';
--    → null
-- 2. Sign up a fresh test account → app shows 30 days left, not ~150.
-- 3. select count(*) from public.user_profiles where plan = 'founding_lifetime';
--    → real paid founding members only. Test-mode checkouts also set this
--    plan, so clear any test purchases before launch.
