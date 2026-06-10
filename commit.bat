@echo off
git add "app/globals.css" "app/(reader)/main/epaper/EPaperPageClient.tsx"
git commit -m "feat: mobile epaper UX - responsive grid tabbar, branded scrollbar, remove header date"
git push
echo Done.
