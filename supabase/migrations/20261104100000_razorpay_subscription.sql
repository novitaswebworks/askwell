-- Razorpay's own ID for the owner's subscription (sub_...). The subscribe route
-- stores it; the Razorpay webhook uses it to find the owner. Additive: existing
-- rows get null and keep working. accounts.cashfree_subscription_id stays for now
-- and is dropped in a later migration, once no deployed code reads it.
alter table public.accounts add column razorpay_subscription_id text;

-- One subscription belongs to one account.
create unique index accounts_razorpay_subscription_id_key
  on public.accounts (razorpay_subscription_id)
  where razorpay_subscription_id is not null;
-- No grants: accounts stays server-only (service_role), as before.
