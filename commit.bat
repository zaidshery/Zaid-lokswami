@echo off
git add lib/notifications/teamInviteEmail.ts app/api/admin/team/route.ts app/api/admin/team/[id]/setup-link/route.ts app/(admin)/admin/team/TeamManagementClient.tsx
git commit -m "feat: Implement secure automated email invitations via Resend"
git push
echo Done.

