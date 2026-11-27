@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title KuroCat 动物桌宠 - 一键打包 exe

echo.
echo  ============================================================
echo   KuroCat 自定义动物桌宠  -  一键打包 Windows exe
echo  ============================================================
echo.

cd /d "%~dp0"

REM ---- 1. Check Node ----
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js，请先安装 Node.js 18+ : https://nodejs.org/
  pause & exit /b 1
)
echo [1/5] Node.js: 
node --version

REM ---- 2. Check Rust ----
if not exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
  echo [错误] 未找到 Rust，请先安装 Rust: https://rustup.rs/
  pause & exit /b 1
)
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
echo [2/5] Rust:
cargo --version

REM ---- 3. Check MSVC linker ----
where link.exe >nul 2>nul
if errorlevel 1 (
  echo.
  echo [警告] 未检测到 MSVC 的 link.exe。
  echo   Tauri 打包需要 Visual Studio C++ 构建工具。
  echo   如果稍后编译失败，请安装：
  echo     winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  echo.
)

REM ---- 4. npm install ----
if not exist "node_modules" (
  echo [3/5] 正在安装前端依赖（首次较慢）...
  call npm install
  if errorlevel 1 ( echo [错误] npm install 失败 & pause & exit /b 1 )
) else (
  echo [3/5] 前端依赖已存在，跳过安装
)

REM ---- 5. Build ----
echo [4/5] 正在编译 Release 安装包（首次编译 Rust 约需 5-15 分钟）...
call npx tauri build
if errorlevel 1 (
  echo.
  echo [错误] 打包失败。请查看上方日志。
  echo   常见原因：缺少 MSVC 构建工具 / 网络导致依赖下载失败。
  pause & exit /b 1
)

echo [5/5] 完成！
echo.
echo  ============================================================
echo   安装包已生成：
echo.
if exist "src-tauri\target\release\bundle\nsis\KuroCat_5.1.3_x64-setup.exe" (
  echo   %~dp0src-tauri\target\release\bundle\nsis\KuroCat_5.1.3_x64-setup.exe
)
echo.
echo   免安装绿色版：
if exist "src-tauri\target\release\KuroCat.exe" (
  echo   %~dp0src-tauri\target\release\KuroCat.exe
)
echo  ============================================================
echo.
echo 提示：把「动物工坊」生成的 cats.json 放到
echo       %%APPDATA%%\kuro-cat-pet\cats.json 即可换动物。
echo.
pause
