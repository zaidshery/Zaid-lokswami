@echo off
git add app/api/admin/epapers/[id]/processing/route.ts
git commit -m "fix: Resolve TypeScript error regarding deprecated qa_review status"
git push
echo Done.
pause
