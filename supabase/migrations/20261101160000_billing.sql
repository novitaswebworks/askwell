-- Our own ID for the owner's Cashfree subscription. The billing routes create
-- it; the Cashfree webhook uses it to find the owner. Additive: existing rows
-- get null and keep working.
alter table public.accounts add column cashfree_subscription_id text;

-- One subscription belongs to one account.
create unique index accounts_cashfree_subscription_id_key
  on public.accounts (cashfree_subscription_id)
  where cashfree_subscription_id is not null;
-- No grants: accounts stays server-only (service_role), as before.
