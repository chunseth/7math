-- Additive curriculum foundation. Apply after schema.sql to existing deployments.
-- No anonymous table reads or writes. Username players retrieve assignments through
-- a credential-checked RPC, matching the current game's username/PIN identity model.
create table if not exists public.curriculum_concepts (
  id text primary key,
  title text not null
);
insert into public.curriculum_concepts(id, title) values
('review.add', 'Addition'),
('review.subtract', 'Subtraction'),
('review.multiply', 'Multiplication facts'),
('review.divide', 'Division facts'),
('review.whole', 'Whole-number operations'),
('review.factors', 'Factors and multiples'),
('review.fractions', 'Fraction representations'),
('review.conversions', 'Fraction decimal percent equivalence'),
('review.numberline', 'Rational-number sense'),
('review.expressions', 'Expression foundations'),
('review.coordinate', 'Coordinate plane'),
('review.area', 'Area foundations'),
('review.angles', 'Angle foundations'),
('review.data', 'Data foundations'),
('review.onestep', 'One-step equations and inequalities'),
('number.sets', 'Rational-number set relationships'),
('number.integer-add', 'Signed addition and subtraction'),
('number.integer-multiply', 'Signed multiplication and division'),
('number.decimal', 'Decimal operations'),
('number.fraction', 'Fraction operations'),
('number.mixed', 'Mixed rational expressions'),
('number.context', 'Rational-number applications'),
('ratio.equivalent', 'Ratios and ratio tables'),
('ratio.unit', 'Unit rates'),
('ratio.constant', 'Constant of proportionality'),
('ratio.represent', 'Constant-rate representations'),
('ratio.travel', 'Distance rate and time'),
('ratio.solve', 'Multistep ratio and rate situations'),
('ratio.units', 'Between-system conversions'),
('percent.parts', 'Percent part whole and rate'),
('percent.change', 'Percent change'),
('percent.multistep', 'Multistep percent applications'),
('similar.attributes', 'Similarity relationships'),
('similar.lengths', 'Scale factors and missing sides'),
('similar.drawings', 'Scale drawings'),
('chance.space', 'Sample spaces'),
('chance.theoretical', 'Theoretical probability'),
('chance.complement', 'Events and complements'),
('chance.experimental', 'Experimental probability'),
('chance.simulate', 'Select and run simulations'),
('chance.compare', 'Experiment predictions and comparisons'),
('stats.graphs', 'Graph comparisons and equivalence'),
('stats.groups', 'Compare distributions'),
('stats.sample', 'Population inferences'),
('stats.populations', 'Compare populations'),
('linear.read', 'Rate and initial value'),
('linear.represent', 'Connect linear representations'),
('algebra.check', 'Check proposed solutions'),
('algebra.equation', 'Model and solve two-step equations'),
('algebra.inequality', 'Model and solve two-step inequalities'),
('algebra.write', 'Write constraints as mathematics'),
('algebra.story', 'Create a corresponding situation'),
('algebra.graph', 'Represent solution sets'),
('geometry.angles', 'Build and solve angle equations'),
('circle.pi', 'Circle ratio and formula models'),
('circle.measure', 'Circle measurements'),
('area.composite', 'Composite area'),
('solid.prism', 'Prism volume'),
('solid.models', 'Prism and pyramid volume models'),
('solid.pyramid', 'Pyramid volume'),
('solid.nets', 'Read and construct nets'),
('solid.surface', 'Lateral and total surface area'),
('finance.tax', 'Purchase and wage taxes'),
('finance.budget', 'Personal budget'),
('finance.networth', 'Assets liabilities and net worth'),
('finance.household', 'Family budget estimator'),
('finance.simple', 'Simple interest'),
('finance.compound', 'Compound interest comparison'),
('finance.deals', 'Compare incentives')
on conflict (id) do update set title = excluded.title;

create table if not exists public.concept_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  concept_id text not null references public.curriculum_concepts(id),
  teacher_id uuid not null references public.teachers(id),
  created_at timestamptz not null default now(),
  unique(profile_id, concept_id)
);
create index if not exists concept_assignments_profile_idx on public.concept_assignments(profile_id);
alter table public.curriculum_concepts enable row level security;
alter table public.concept_assignments enable row level security;
revoke all on public.curriculum_concepts, public.concept_assignments from anon;
grant select on public.curriculum_concepts to authenticated;
grant select, insert, delete on public.concept_assignments to authenticated;

drop policy if exists "Read curriculum concepts" on public.curriculum_concepts;
create policy "Read curriculum concepts" on public.curriculum_concepts for select to authenticated using (true);
drop policy if exists "Active teachers read assignments" on public.concept_assignments;
create policy "Active teachers read assignments" on public.concept_assignments for select to authenticated
using (exists (select 1 from public.teachers t where t.auth_user_id = auth.uid() and t.is_active));
drop policy if exists "Active teachers assign concepts" on public.concept_assignments;
create policy "Active teachers assign concepts" on public.concept_assignments for insert to authenticated
with check (exists (select 1 from public.teachers t where t.id = teacher_id and t.auth_user_id = auth.uid() and t.is_active));
drop policy if exists "Teachers remove own assignments" on public.concept_assignments;
create policy "Teachers remove own assignments" on public.concept_assignments for delete to authenticated
using (exists (select 1 from public.teachers t where t.id = teacher_id and t.auth_user_id = auth.uid() and t.is_active));
drop policy if exists "Students read own concept assignments" on public.concept_assignments;
create policy "Students read own concept assignments" on public.concept_assignments for select to authenticated
using (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid()));

create or replace function public.get_concept_assignments(player_username text, player_pin text)
returns table(concept_id text)
language plpgsql security definer set search_path = '' as $$
declare player_id uuid;
begin
  select p.id into player_id from public.profiles p
  where p.username = lower(trim(player_username)) and p.pin_code = player_pin;
  if player_id is null then raise exception 'Username or PIN is incorrect.'; end if;
  return query select a.concept_id from public.concept_assignments a where a.profile_id = player_id order by a.created_at;
end;
$$;
revoke all on function public.get_concept_assignments(text, text) from public;
grant execute on function public.get_concept_assignments(text, text) to anon, authenticated;
