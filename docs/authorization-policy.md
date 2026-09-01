# schwank authorization policy

This document is the source of truth for server-side access control. UI visibility is not authorization. Every read query and mutation must enforce the matching rule in the database layer or route handler.

## Policy classes

| Class             | Read rule                                                               | Mutation rule                                                    |
| ----------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Personal-only     | Only the subject user                                                   | Only the subject user; request bodies cannot select another user |
| Private/shareable | Creator always; other household members only when `visibility = shared` | Creator only, including when shared                              |
| Household-public  | Every authenticated household member                                    | Domain-specific ownership rules below                            |
| Household-global  | Every authenticated household member                                    | Every authenticated household member                             |
| Owner-only        | Household owner only                                                    | Household owner only                                             |

No application data is available to anonymous requests. The public enrollment-status endpoint reveals only whether this is a fresh installation and whether registration is currently open.

## Domain matrix

| Domain                                  | Class                             | Data visible to another member                                             | Who may create                       | Who may modify/delete                                        |
| --------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| Account email and nutrition profile     | Personal-only                     | None                                                                       | Account user                         | Account user                                                 |
| Password and sessions                   | Personal-only                     | None                                                                       | Account user                         | Account user; session IDs are scoped to that user            |
| Avatar, display name, initials, color   | Household-public directory        | Public member identity fields only; never email or health profile          | Account user                         | Account user                                                 |
| Nutrition entries                       | Private/shareable                 | Entries explicitly marked shared                                           | Any member for themselves            | Creator only; current product has no edit/delete action      |
| Tasks                                   | Private/shareable                 | Tasks explicitly marked shared                                             | Any member                           | Creator only                                                 |
| Expenses                                | Private/shareable                 | Expenses explicitly marked shared                                          | Any member                           | Creator only; current product has no edit/delete action      |
| Recurring payments                      | Private/shareable                 | Payments explicitly marked shared                                          | Any member                           | Creator only, including recording a payment                  |
| Organiser items                         | Private/shareable                 | Items explicitly marked shared                                             | Any member                           | Creator only                                                 |
| Reminders                               | Private/shareable                 | Reminders explicitly marked shared                                         | Any member                           | Creator only                                                 |
| Medications and dose history            | Private/shareable                 | Shared medication details and their recorded dose history                  | Any member for themselves            | Medication creator only                                      |
| Water log and goal                      | Personal-only                     | None                                                                       | Account user                         | Account user                                                 |
| Habit events and cost                   | Household-public                  | All events and spending are intentionally public                           | Any member for themselves            | Append-only in the current product                           |
| Chat                                    | Household-public                  | All messages                                                               | Any member for themselves            | Append-only in the current product                           |
| Wishlist ideas                          | Household-public                  | All non-archived ideas                                                     | Any member                           | Idea creator controls status                                 |
| Wishlist votes                          | Household-public                  | Every member’s vote and identity                                           | Any member for their own vote        | Voter controls only their vote                               |
| Home name, address, and photo           | Household-global                  | All fields                                                                 | Any member                           | Any member                                                   |
| Food inventory                          | Household-global                  | All stock and updater identity                                             | Any member                           | Any member                                                   |
| Recipes                                 | Household-global                  | All recipes and creator identity                                           | Any member                           | Any member                                                   |
| Weekly meal plan                        | Household-global                  | Entire plan                                                                | Any member                           | Any member                                                   |
| AI nutrition input                      | Consent-gated household aggregate | No individual profile or consumption history is returned to another member | Each user controls their own consent | Meal-plan requester may use only consenting aggregate inputs |
| Enrollment settings and invite rotation | Owner-only                        | Public endpoint exposes open/closed only                                   | Owner                                | Owner                                                        |

## Authentication and enrollment

- The first account on a fresh installation becomes the household owner.
- Established households are closed to registration unless the owner creates a time-limited invite.
- Invite codes are stored only as hashes and are invalidated when registration closes.
- Login and registration failures are persistently rate-limited using hashed request buckets.
- Password changes require the current password, rotate the current session token, and revoke every other session.
- Same-origin validation is required for every state-changing route.

## Error contract

Every API failure returns JSON shaped as:

```json
{
  "error": "English diagnostic for logs and older clients",
  "code": "stable_machine_code"
}
```

Clients must translate the stable `code` and must not display the diagnostic as localized UI copy. Unknown codes use a localized generic fallback. Unexpected server errors use `internal_error` and never expose internal exception text.

Stable codes currently include authentication, enrollment, validation, ownership, not-found, conflict, AI availability, and internal-error families. Adding a code is backward-compatible; changing the meaning of an existing code is not.

## Review checklist

For every new domain or mutation:

1. Assign one policy class in this document.
2. Scope database reads by authenticated user and visibility before returning rows.
3. Scope creator-only writes with both record ID and authenticated user ID.
4. Return the same `not_found` or `forbidden` result for unauthorized guessed IDs; never return the record.
5. Add a two-user integration test covering private reads and unauthorized writes.
6. Confirm notifications, aggregates, AI context, and error messages do not leak private details.
