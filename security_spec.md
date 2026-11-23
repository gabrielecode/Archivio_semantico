# Security Specification & Payload-First TDD

## 1. Data Invariants
- Every document in `/users/{userId}` belongs strictly to the authenticated user whose `request.auth.uid == userId`, and `uid` inside the document must match `userId` and `request.auth.uid`.
- Only email-verified users (`request.auth.token.email_verified == true`) may create or update their own `/users/{userId}` profile document.
- `uid` and `createdAt` are immutable after creation; non-admin owners may only update `email`, `displayName`, and `lastLogin`.
- `get` on `/users/{userId}` is restricted to the document owner or the verified bootstrapped admin (`gestsocialgabriele@gmail.com`).
- `list` on `/users` is restricted strictly to the verified admin (`AdminPanel`).
- All string fields enforce explicit `.size()` bounds; `uid` and `userId` enforce `^[a-zA-Z0-9_\-]+$` and `<= 128` chars.

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated `setDoc` to `/users/uid123` -> DENIED.
2. Authenticated unverified (`email_verified: false`) `setDoc` to `/users/uid123` -> DENIED.
3. Authenticated user writing to another user's `/users/otherUid` -> DENIED.
4. Spoofed `uid` field in payload (`uid: "otherUid"`) under `/users/myUid` -> DENIED.
5. Ghost/shadow field (`isAdmin: true` or `role: "admin"`) in payload -> DENIED (`hasOnly` check).
6. Missing required field (`createdAt` omitted on create) -> DENIED (`hasAll` check).
7. Oversized `displayName` (> 120 chars) -> DENIED.
8. Oversized `email` (> 320 chars) -> DENIED.
9. Invalid `userId` path variable (> 128 chars or containing invalid characters) -> DENIED (`isValidId`).
10. Attempt to mutate `uid` or `createdAt` on `update` -> DENIED.
11. Non-admin `list` query on `/users` collection -> DENIED.
12. Email spoofing (`email: "gestsocialgabriele@gmail.com"` with `email_verified: false`) attempting `list` or `get` -> DENIED.
