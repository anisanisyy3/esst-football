# RLS / Security Test Checklist (manual, requires live Supabase)

Run these after configuring Supabase and creating test accounts.

1. Anonymous visitor cannot read `profiles` (expect 401/empty).
2. A normal member cannot read another member's `birth_year`, `height_cm`,
   `weight_kg` unless shared (column-level: verify via direct REST).
3. A member can read football-facing fields (name, photo, position, ovr) of
   other members.
4. A pending user (role 'member' with profile_complete false) has no staff or
   team-management permissions.
5. A member cannot update their own `role`, `ovr`, or `profile_complete`-gated
   official records (only allowed profile fields).
6. A captain can manage only their own team's join requests and lineups.
7. Other teams cannot read a team's pre-kickoff lineup/tactics/posts (RLS
   returns empty, not just hidden UI).
8. Lineup becomes publicly readable only after `mark_match_live`.
9. After LIVE, the lineup row is locked (`is_locked = true`) and captain edits
   are rejected.
10. Max 45 active members: fire 50 concurrent `decide_join_request` calls for
    one team; verify exactly 45 succeed and the rest raise `TEAM_FULL`.
11. One active membership per player: a second `request_join_team` while active
    raises `ALREADY_IN_A_TEAM`.
12. Team creator becomes captain only after Super Admin approves.
13. Transfer workflow: captain approval then Super Admin final approval closes
    old membership and opens new one atomically.
14. Lineup validation: 10 starters rejected, 8 subs rejected, duplicate player
    rejected, suspended player rejected (server-side).
15. Unused substitutes receive no appearance/OVR (verify ledger).
16. Score mismatch: submitting a report whose referee score disagrees with the
    derived score raises `SCORE_MISMATCH`.
17. Correction: `correct_match_report` clears derived rows; re-submitting does
    not double-count (verify OVR returns to pre-match value then applies new).
18. Last super admin: demoting the only super admin raises `LAST_SUPER_ADMIN`.
19. Self role change: a user calling `change_manager_role(self, ...)` raises.
20. Bootstrap: `bootstrap_super_admin` raises once a super admin exists.
21. Realtime subscriptions only receive rows the user is allowed to see.
