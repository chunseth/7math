begin;
-- Existing mixed-grade runs retain their scores without entering a grade leaderboard.
alter table mentalist.rush_runs add column grade smallint check (grade in (6, 7, 8));
create index rush_grade_completed_runs
  on mentalist.rush_runs(grade, profile, score desc, elapsed_ms)
  where score is not null and grade is not null;
commit;
