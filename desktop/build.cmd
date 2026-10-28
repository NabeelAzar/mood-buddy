@echo off
setlocal
rem Builds the desktop buddy with the C# compiler that ships with Windows.
rem   build.cmd            builds into desktop\build\ (for working on the code)
rem   build.cmd <folder>   builds into <folder>, as "/buddy desktop" does
rem The first build downloads Microsoft's WebView2 SDK from nuget.org, checks it
rem against a pinned SHA-256, and keeps the three DLLs it needs in a lib folder.
rem It has no labels, calls or gotos, so it runs the same with Windows or Unix line endings.
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
rem Windows' own tools, by full path: Git for Windows puts a GNU tar on PATH that reads "C:" as a host.
set SYS=%SystemRoot%\System32
set HERE=%~dp0
set OUT=%HERE%build
set LIB=%HERE%lib
if not "%~1"=="" set "OUT=%~1"
if not "%~1"=="" set "LIB=%~1\lib"
set WEBVIEW2_VERSION=1.0.2903.40
set WEBVIEW2_SHA256=ef128016dd1e51c59178c827ed5b8aa3322c57afa8675d930f8109505542ad74
set PKG=%TEMP%\mood-buddy-webview2-%WEBVIEW2_VERSION%.nupkg
set UNPACK=%TEMP%\mood-buddy-webview2-%WEBVIEW2_VERSION%

if not exist "%CSC%" (echo The .NET Framework C# compiler isn't on this computer: %CSC% & exit /b 1)

set NEED_SDK=
if not exist "%LIB%\Microsoft.Web.WebView2.Core.dll" set NEED_SDK=1
if not exist "%LIB%\Microsoft.Web.WebView2.WinForms.dll" set NEED_SDK=1
if not exist "%LIB%\WebView2Loader.dll" set NEED_SDK=1
if defined NEED_SDK (
  echo Downloading the WebView2 SDK %WEBVIEW2_VERSION% from nuget.org...
  "%SYS%\curl.exe" -fsSL -o "%PKG%" "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/%WEBVIEW2_VERSION%" || (echo Download failed. & exit /b 1)
  "%SYS%\certutil.exe" -hashfile "%PKG%" SHA256 | "%SYS%\findstr.exe" /i "%WEBVIEW2_SHA256%" >nul || (echo The download doesn't match the expected checksum; not using it. & del "%PKG%" & exit /b 1)
  if exist "%UNPACK%" rmdir /s /q "%UNPACK%"
  mkdir "%UNPACK%"
  "%SYS%\tar.exe" -xf "%PKG%" -C "%UNPACK%" lib/net462/Microsoft.Web.WebView2.Core.dll lib/net462/Microsoft.Web.WebView2.WinForms.dll runtimes/win-x64/native/WebView2Loader.dll || (echo Unpacking failed. & exit /b 1)
  if not exist "%LIB%" mkdir "%LIB%"
  copy /y "%UNPACK%\lib\net462\Microsoft.Web.WebView2.Core.dll" "%LIB%\" >nul
  copy /y "%UNPACK%\lib\net462\Microsoft.Web.WebView2.WinForms.dll" "%LIB%\" >nul
  copy /y "%UNPACK%\runtimes\win-x64\native\WebView2Loader.dll" "%LIB%\" >nul
  rmdir /s /q "%UNPACK%"
  del "%PKG%"
)

if not exist "%OUT%" mkdir "%OUT%"
"%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /out:"%OUT%\MoodBuddy.exe" /r:"%LIB%\Microsoft.Web.WebView2.Core.dll" /r:"%LIB%\Microsoft.Web.WebView2.WinForms.dll" /r:System.Windows.Forms.dll /r:System.Drawing.dll "%HERE%MoodBuddy.cs" || exit /b 1
copy /y "%LIB%\*.dll" "%OUT%\" >nul
copy /y "%HERE%index.html" "%OUT%\" >nul
copy /y "%HERE%renderer.js" "%OUT%\" >nul
echo Built %OUT%\MoodBuddy.exe
