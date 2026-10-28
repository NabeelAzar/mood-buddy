@echo off
setlocal
rem Builds the desktop buddy with the C# compiler that ships with Windows.
rem   build.cmd                        builds into desktop\build\ (for working on the code)
rem   build.cmd <folder> <fingerprint> what "/buddy desktop" puts on your clipboard to run with
rem                                    Win+R: closes a running buddy, builds into <folder>,
rem                                    records <fingerprint> (which source it was built from)
rem                                    in <folder>\source.sha256, and starts the new buddy
rem The first build downloads Microsoft's WebView2 SDK from nuget.org, checks it
rem against a pinned SHA-256, and keeps the three DLLs it needs in a lib folder.
rem It has no labels, calls or gotos, so it runs the same with Windows or Unix line endings.
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
rem Windows' own tools, by full path: Git for Windows puts a GNU tar on PATH that reads "C:" as a host.
set SYS=%SystemRoot%\System32
set HERE=%~dp0
set OUT=%HERE%build
set LIB=%HERE%lib
rem Run from Win+R, the window would close before an error could be read, so it waits.
set ASK=
if not "%~1"=="" set "OUT=%~1"
if not "%~1"=="" set "LIB=%~1\lib"
if not "%~1"=="" set ASK=1
set WEBVIEW2_VERSION=1.0.2903.40
set WEBVIEW2_SHA256=ef128016dd1e51c59178c827ed5b8aa3322c57afa8675d930f8109505542ad74
set PKG=%TEMP%\mood-buddy-webview2-%WEBVIEW2_VERSION%.nupkg
set UNPACK=%TEMP%\mood-buddy-webview2-%WEBVIEW2_VERSION%

echo Building the mood buddy for your desktop...
if not exist "%CSC%" (echo The .NET Framework C# compiler isn't on this computer: %CSC% & (if defined ASK pause) & exit /b 1)

set NEED_SDK=
if not exist "%LIB%\Microsoft.Web.WebView2.Core.dll" set NEED_SDK=1
if not exist "%LIB%\Microsoft.Web.WebView2.WinForms.dll" set NEED_SDK=1
if not exist "%LIB%\WebView2Loader.dll" set NEED_SDK=1
if defined NEED_SDK (
  echo Downloading the WebView2 SDK %WEBVIEW2_VERSION% from nuget.org...
  "%SYS%\curl.exe" -fsSL -o "%PKG%" "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/%WEBVIEW2_VERSION%" || (echo Download failed. & (if defined ASK pause) & exit /b 1)
  "%SYS%\certutil.exe" -hashfile "%PKG%" SHA256 | "%SYS%\findstr.exe" /i "%WEBVIEW2_SHA256%" >nul || (echo The download doesn't match the expected checksum; not using it. & del "%PKG%" & (if defined ASK pause) & exit /b 1)
  if exist "%UNPACK%" rmdir /s /q "%UNPACK%"
  mkdir "%UNPACK%"
  "%SYS%\tar.exe" -xf "%PKG%" -C "%UNPACK%" lib/net462/Microsoft.Web.WebView2.Core.dll lib/net462/Microsoft.Web.WebView2.WinForms.dll runtimes/win-x64/native/WebView2Loader.dll || (echo Unpacking failed. & (if defined ASK pause) & exit /b 1)
  if not exist "%LIB%" mkdir "%LIB%"
  copy /y "%UNPACK%\lib\net462\Microsoft.Web.WebView2.Core.dll" "%LIB%\" >nul
  copy /y "%UNPACK%\lib\net462\Microsoft.Web.WebView2.WinForms.dll" "%LIB%\" >nul
  copy /y "%UNPACK%\runtimes\win-x64\native\WebView2Loader.dll" "%LIB%\" >nul
  rmdir /s /q "%UNPACK%"
  del "%PKG%"
)

rem A running buddy locks its program file, so it's closed first; the new one starts at the end.
if defined ASK "%SYS%\taskkill.exe" /im MoodBuddy.exe /f >nul 2>&1
if defined ASK "%SYS%\timeout.exe" /t 1 /nobreak >nul

if not exist "%OUT%" mkdir "%OUT%"
"%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /out:"%OUT%\MoodBuddy.exe" /r:"%LIB%\Microsoft.Web.WebView2.Core.dll" /r:"%LIB%\Microsoft.Web.WebView2.WinForms.dll" /r:System.Windows.Forms.dll /r:System.Drawing.dll "%HERE%MoodBuddy.cs" || ((if defined ASK pause) & exit /b 1)
copy /y "%LIB%\*.dll" "%OUT%\" >nul
copy /y "%HERE%index.html" "%OUT%\" >nul
copy /y "%HERE%renderer.js" "%OUT%\" >nul
if not "%~2"=="" (> "%OUT%\source.sha256" echo %~2)
echo Built %OUT%\MoodBuddy.exe
if defined ASK start "" "%OUT%\MoodBuddy.exe"
