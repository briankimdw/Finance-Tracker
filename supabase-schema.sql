-- FlipTracker Database Schema
-- Run this in your Supabase SQL Editor to set up all tables

-- Items table (reselling inventory + sold items)
create table public.items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  purchase_price numeric(10, 2) not null,
  purchase_date date not null,
  platform_bought text not null,
  condition text not null,
  notes text,
  status text not null default 'active' check (status in ('active', 'sold')),
  sale_price numeric(10, 2),
  sale_date date,
  platform_sold text,
  fees numeric(10, 2) default 0,
  shipping_costs numeric(10, 2) default 0,
  created_at timestamptz default now() not null
);

alter table public.items enable row level security;
create policy "Users can view own items" on public.items for select using (auth.uid() = user_id);
create policy "Users can insert own items" on public.items for insert with check (auth.uid() = user_id);
create policy "Users can update own items" on public.items for update using (auth.uid() = user_id);
create policy "Users can delete own items" on public.items for delete using (auth.uid() = user_id);
create policy "Allow anonymous select" on public.items for select using (user_id is null);
create policy "Allow anonymous insert" on public.items for insert with check (user_id is null);
create policy "Allow anonymous update" on public.items for update using (user_id is null);
create policy "Allow anonymous delete" on public.items for delete using (user_id is null);
create index items_user_id_idx on public.items(user_id);
create index items_status_idx on public.items(status);
create index items_user_status_idx on public.items(user_id, status);

-- Income table (main + side income tracking)
create table public.income (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('main', 'side')),
  source text not null,
  category text not null,
  amount numeric(10, 2) not null,
  date date not null,
  recurring boolean not null default false,
  frequency text check (frequency in ('Weekly', 'Biweekly', 'Monthly', 'One-time')),
  notes text,
  created_at timestamptz default now() not null
);

alter table public.income enable row level security;
create policy "Users can view own income" on public.income for select using (auth.uid() = user_id);
create policy "Users can insert own income" on public.income for insert with check (auth.uid() = user_id);
create policy "Users can update own income" on public.income for update using (auth.uid() = user_id);
create policy "Users can delete own income" on public.income for delete using (auth.uid() = user_id);
create policy "Allow anonymous select income" on public.income for select using (user_id is null);
create policy "Allow anonymous insert income" on public.income for insert with check (user_id is null);
create policy "Allow anonymous update income" on public.income for update using (user_id is null);
create policy "Allow anonymous delete income" on public.income for delete using (user_id is null);
create index income_user_id_idx on public.income(user_id);
create index income_type_idx on public.income(type);

-- Saved income templates (quick-add)
create table public.saved_income (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('main', 'side')),
  source text not null,
  category text not null,
  amount numeric(10, 2) not null,
  frequency text check (frequency in ('Weekly', 'Biweekly', 'Monthly', 'One-time')),
  created_at timestamptz default now() not null
);

alter table public.saved_income enable row level security;
create policy "Users can view own saved_income" on public.saved_income for select using (auth.uid() = user_id);
create policy "Users can insert own saved_income" on public.saved_income for insert with check (auth.uid() = user_id);
create policy "Users can delete own saved_income" on public.saved_income for delete using (auth.uid() = user_id);
create policy "Allow anonymous select saved_income" on public.saved_income for select using (user_id is null);
create policy "Allow anonymous insert saved_income" on public.saved_income for insert with check (user_id is null);
create policy "Allow anonymous delete saved_income" on public.saved_income for delete using (user_id is null);
create index saved_income_user_id_idx on public.saved_income(user_id);
