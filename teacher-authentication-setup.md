# Teacher Authentication Setup

The teacher dashboard at `/teacher` uses Supabase Auth with email and password. Only authenticated users with an active row in `public.teachers` can load dashboard data.

## 1. Apply the Database Schema

Run the current `supabase/schema.sql` file in the Supabase SQL Editor. It creates:

- The `public.teachers` table
- Teacher membership checks
- Read-only teacher policies for student performance tables
- Realtime publications and dashboard indexes

## 2. Create a Teacher Login

In the Supabase dashboard:

1. Open **Authentication → Users**.
2. Select **Add user**.
3. Enter the teacher's email and a secure password. UNtiEMEUNHAND
4. Create the user with the email already confirmed.

## 3. Grant Teacher Access

Run the following in the Supabase SQL Editor, replacing the example values:

```sql
insert into public.teachers (auth_user_id, email, display_name)
select id, email, 'Teacher Name'
from auth.users
where email = 'teacher@example.com'
on conflict (auth_user_id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  is_active = true;
```

The teacher can then sign in at `/teacher`.

## Removing Access

Disable dashboard access without deleting the authentication account:

```sql
update public.teachers
set is_active = false
where email = 'teacher@example.com';
```

Teacher sessions are stored separately from student game state, so signing into the dashboard does not interfere with students using the arena in another tab.
