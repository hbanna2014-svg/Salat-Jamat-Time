# Security Specification - Mosque Jama'at Alert

## Data Invariants
1. **Users**:
    - Every user must have a unique UID (Firebase Auth).
    - `role` must be one of `['admin', 'authority', 'user']`.
    - Only `admin` can set other users' roles.

2. **Mosques**:
    - Every mosque must have a `name`, `adminUid`, `active` status, and `prayerTimes`.
    - `adminUid` must point to a user with role `authority` or `admin`.
    - Only `admin` can create or delete mosques.
    - `authority` can update mosques they are assigned to (where `adminUid == request.auth.uid`).

3. **Masayel (Library)**:
    - Fiqh questions can only be created/updated/deleted by `admin`.
    - Public can read all entries.

## The "Dirty Dozen" Payloads (Targeting Firestore Rules)

| # | Collection | Operation | Payload / Action | Intent |
|---|---|---|---|---|
| 1 | `users` | `create` | `{ "email": "evil@attacker.com", "role": "admin" }` | Self-elevate to admin |
| 2 | `users` | `update` | `{ "role": "admin" }` | Elevate existing account to admin |
| 3 | `users` | `update` | Change someone else's email | Identity theft / hijacking |
| 4 | `mosques` | `create` | `{ "name": "Fake Mosque", "adminUid": "attacker_uid" }` | Unauthorized mosque creation |
| 5 | `mosques` | `update` | Change `adminUid` to someone else | Hijack mosque management |
| 6 | `mosques` | `update` | Update by non-authority user | Unauthorized modification of prayer times |
| 7 | `mosques` | `update` | Inject 2MB string into `description` | Denial of Wallet via storage bloat |
| 8 | `mosques` | `delete` | Delete by mosque authority | Unauthorized mosque deletion (only admin should) |
| 9 | `masayel` | `create` | `{ "question": "...", "answer": "..." }` | Unauthorized library management |
| 10 | `users` | `list` | Blanket query for all users | PII leak (email list) |
| 11 | `mosques` | `update` | Change `createdAt` | Corrupting audit trails |
| 12 | `mosques` | `update` | Adding fields not in schema | Shadow fields injection |

## Test Runner (Internal Logic check)
- See `firestore.rules.test.ts` for implementation.
