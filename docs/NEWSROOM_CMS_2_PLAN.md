# Newsroom CMS 2 Plan

Last reviewed: 2026-05-09

## Current Admin CMS Assessment

Strengths:

- Admin shell exists with role-aware navigation.
- Pages already exist for my work, review queue, assignments, copy desk,
  articles, stories, videos, e-paper, media, polls, social posts, analytics,
  operations, team, settings, revenue, and audit log.
- Workflow status, comments, actors, priorities, and e-paper production status
  types already exist.
- Server-side permission helpers exist in `lib/auth/permissions.ts`.
- Activity/audit models exist for operational history.

Risks:

- Many routes still build response/error shapes manually.
- Some CMS pages likely duplicate table, filter, badge, and empty/error state
  patterns.
- Workflow is present but should be made more visible and consistent across
  content types.
- Heavy admin actions such as OCR, AI, TTS, media processing, and social
  automation should become worker-backed.

## Target Newsroom Workflow

```text
Draft -> Submitted -> In Review -> Copy Edit -> Approved -> Scheduled -> Published
```

Supported exception paths:

```text
In Review -> Changes Requested -> Draft
Copy Edit -> Changes Requested -> Draft
Approved -> Scheduled
Any editable state -> Archived
Submitted/In Review -> Rejected
```

Existing statuses include:

```text
draft, submitted, assigned, in_review, copy_edit, changes_requested,
ready_for_approval, approved, scheduled, published, rejected, archived
```

The UI can map `assigned` and `ready_for_approval` into the target workflow
without removing existing statuses.

## Role Model

- Reporter: create stories/articles, edit own drafts, respond to changes.
- Copy Editor: review assigned work, copy edit, request changes.
- Editor: approve, schedule, publish, manage review queue.
- Admin: manage content modules, assignments, analytics, operations.
- Super Admin: settings, users/roles, audit, permission review, deployment
  safeguards.
- Viewer: read-only future role for business/leadership dashboards.

Current role implementation includes:

```text
reader, reporter, copy_editor, admin, super_admin
```

Add `viewer` only after a concrete read-only dashboard need is implemented.

## Required Admin Modules

- My Work.
- Review Queue.
- Articles.
- Videos.
- Shorts.
- E-paper.
- Live Streams.
- Breaking News.
- Categories.
- Cities.
- Authors.
- Ads.
- Analytics.
- Users/Roles.

Current gaps:

- Live Streams is not a full module yet.
- Cities/authors/ads need dedicated product modeling if they are not fully
  covered by current category/revenue/team surfaces.
- Shorts currently ride on the video model through `isShort`; this is fine for
  now.

## UI Components Needed

- `AdminPageShell`.
- `AdminPageHeader`.
- `DataTable`.
- `MobileListCard`.
- `FilterToolbar`.
- `StatusBadge`.
- `RoleBadge`.
- `PriorityBadge`.
- `WorkflowStepper`.
- `AssignmentPanel`.
- `ActivityTimeline`.
- `CommentComposer`.
- `ReviewActionBar`.
- `ConfirmDialog`.
- `ToastSystem`.
- Empty states.
- Error states.
- Skeleton states.

Implementation rule:

- Build shared components only when two or more CMS screens need the same
  behavior.
- Keep dense operational layouts for CMS. Avoid marketing-style hero sections
  inside admin tools.

## Server-side Permission Enforcement Plan

- Keep `lib/auth/permissions.ts` as the permission policy entrypoint.
- Continue checking permissions inside route handlers.
- Use `withAdminApi` or a successor wrapper for new admin v1 routes.
- Keep admin mutation audit logging.
- For workflow transitions, check both role and content relationship:
  creator, assignee, reviewer, or admin.
- Never rely on hidden buttons as the only protection.

## Audit Log Plan

Record these events:

- Login/setup/admin credential changes.
- Article/story/video/e-paper create, edit, publish, schedule, archive.
- Workflow transition.
- Assignment change.
- Comment/review note.
- Upload init/complete/delete.
- AI generation requested/completed/failed.
- Notification sent.
- Live stream started/ended.
- Ad campaign changes.

Audit fields:

- actor ID/email/role.
- action.
- resource type and ID.
- request ID.
- route/method.
- before/after summary where safe.
- status and error.
- timestamp.

## Phase 1 CMS Improvements

- Create a shared page header pattern for new pages.
- Add consistent workflow badges.
- Add review queue filters by status, assignee, priority, and content type.
- Add activity timeline to article, story, video, and e-paper edit pages.
- Keep route behavior unchanged while adding shared pieces.

## Phase 2 CMS Improvements

- Add assignment drawer.
- Add bulk action bar.
- Add scheduled publish queue.
- Add live stream module.
- Add ad slot/campaign manager.
- Add richer analytics cards by module.

## Phase 3 CMS Improvements

- Worker status dashboard.
- Failed jobs queue.
- Push notification composer and delivery log.
- Editorial calendar.
- Mobile-friendly admin list cards for daily newsroom use.
