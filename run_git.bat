@echo off
echo Running git status... > c:\Users\Appex\Zaid-lokswami\git_info.txt
git status >> c:\Users\Appex\Zaid-lokswami\git_info.txt 2>&1
echo. >> c:\Users\Appex\Zaid-lokswami\git_info.txt
echo Running git diff... >> c:\Users\Appex\Zaid-lokswami\git_info.txt
git diff >> c:\Users\Appex\Zaid-lokswami\git_info.txt 2>&1
echo Done. >> c:\Users\Appex\Zaid-lokswami\git_info.txt
