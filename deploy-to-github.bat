@echo off
REM ================================================
REM  XG THUNDER EMOTE - GitHub push helper
REM  Pehle: https://git-scm.com/download/win se Git install karo
REM  Phir ye file Run karo
REM ================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo [1/6] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo  ERROR: Git installed nahi hai.
  echo  1. Isse download karo: https://git-scm.com/download/win
  echo  2. Install karo (Next Next Done).
  echo  3. Naya terminal/PowerShell kholo aur ye script dobara chalao.
  echo.
  pause
  exit /b 1
)

REM ======= YAHAN SABSE IMPORTANT: APNI DETAILS DAALO =======
set GITHUB_URL=https://github.com/jobidea23/xg-emote.git
set GIT_NAME=jobidea23
set GIT_EMAIL=jobidea23@users.noreply.github.com
REM =========================================================

if "%GITHUB_URL%"=="https://github.com/APNA_USERNAME_HERE/xg-emote.git" (
  echo.
  echo  ERROR: Pehle is file ke upar "GITHUB_URL" apni repo ka daalo.
  echo  Step dhyan se padho (GitHub repo banao pehle).
  echo.
  pause
  exit /b 1
)

echo [2/6] Setting git identity...
git config --local user.name "%GIT_NAME%"
git config --local user.email "%GIT_EMAIL%"

echo [3/6] Initializing repo...
git init >nul 2>&1
git branch -M main

echo [4/6] Adding all files...
git add -A

echo [5/6] Committing...
git commit -m "XG Thunder Emote site" >nul
if errorlevel 1 (
  echo.
  echo  WARNING: Commit fail hua. Koi issue ho sakta hai.
)

echo [6/6] Pushing to GitHub...
git remote remove origin >nul 2>&1
git remote add origin "%GITHUB_URL%"
git push -u origin main
if errorlevel 1 (
  echo.
  echo  ERROR: Push fail hua. Password/PAT sahi daala? Username sahi hai?
  echo  GitHub login username + password nahi, balki Personal Access Token hota hai.
  echo  Token banao: GitHub -^> Settings -^> Developer settings -^> Personal access tokens
  echo.
  pause
  exit /b 1
)

echo.
echo ================================================
echo  DONE! Files GitHub par push ho gayi.
echo  Ab Netlify me import karo (steps niche likhe hain).
echo ================================================
pause