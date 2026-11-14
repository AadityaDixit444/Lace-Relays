-- Additive: never rewrites unknown-size observations or drops existing history.
create table if not exists public.shoe_observations (
 id text primary key, shoe_id text not null, brand text not null, article text not null,
 color text not null, edition text not null, range text not null,
 retailer text not null, variant_id text not null, size_uk numeric null,
 price_paise bigint not null, currency text not null, stock text not null,
 observed_at timestamptz not null, retrieved_at timestamptz not null,
 price_type text not null, match_status text not null, url text not null,
 fixture boolean not null default false, payload jsonb not null
);
create index if not exists shoe_observations_shoe_time on public.shoe_observations(shoe_id,observed_at);
alter table public.shoe_observations enable row level security;
revoke all on public.shoe_observations from anon, authenticated;
grant select, insert on public.shoe_observations to service_role;
-- Only server service-role writes/reads. Public API responses are filtered by this app.
