@echo off
setlocal
rem Builds the desktop buddy into build\ with the C# compiler that ships with Windows.
rem The first build downloads Microsoft's WebView2 SDK from nuget.org into lib\,
rem checks it against a pinned SHA-256, and unpacks the three DLLs it needs.
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set HERE=%~dp0
set WEBVIEW2_VERSION=1.0.2903.40
set WEBVIEW2_SHA256=ef128016dd1e51c59178c827ed5b8aa3322c57afa8675d930f8109505542ad74

if not exist "%HERE%lib\Microsoft.Web.WebView2.Core.dll" call :fetch_webview2 || exit /b 1
if not exist "%HERE%lib\Microsoft.Web.WebView2.WinForms.dll" call :fetch_webview2 || exit /b 1
if not exist "%HERE%lib\WebView2Loader.dll" call :fetch_webview2 || exit /b 1

if not exist "%HERE%build" mkdir "%HERE%build"
"%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /out:"%HERE%build\MoodBuddy.exe" /r:"%HERE%lib\Microsoft.Web.WebView2.Core.dll" /r:"%HERE%lib\Microsoft.Web.WebView2.WinForms.dll" /r:System.Windows.Forms.dll /r:System.Drawing.dll "%HERE%MoodBuddy.cs" || exit /b 1
copy /y "%HERE%lib\*.dll" "%HERE%build\" >nul
copy /y "%HERE%index.html" "%HERE%build\" >nul
copy /y "%HERE%renderer.js" "%HERE%build\" >nul
echo Built %HERE%build\MoodBuddy.exe
exit /b 0

:fetch_webview2
set PKG=%TEMP%\mood-buddy-webview2-%WEBVIEW2_VERSION%.nupkg
set UNPACK=%TEMP%\mood-buddy-webview2-%WEBVIEW2_VERSION%
echo Downloading the WebView2 SDK %WEBVIEW2_VERSION% from nuget.org...
curl -fsSL -o "%PKG%" "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/%WEBVIEW2_VERSION%" || (echo Download failed. & exit /b 1)
certutil -hashfile "%PKG%" SHA256 | findstr /i "%WEBVIEW2_SHA256%" >nul || (echo The download doesn't match the expected checksum; not using it. & del "%PKG%" & exit /b 1)
if exist "%UNPACK%" rmdir /s /q "%UNPACK%"
mkdir "%UNPACK%"
tar -xf "%PKG%" -C "%UNPACK%" lib/net462/Microsoft.Web.WebView2.Core.dll lib/net462/Microsoft.Web.WebView2.WinForms.dll runtimes/win-x64/native/WebView2Loader.dll || (echo Unpacking failed. & exit /b 1)
if not exist "%HERE%lib" mkdir "%HERE%lib"
copy /y "%UNPACK%\lib\net462\Microsoft.Web.WebView2.Core.dll" "%HERE%lib\" >nul
copy /y "%UNPACK%\lib\net462\Microsoft.Web.WebView2.WinForms.dll" "%HERE%lib\" >nul
copy /y "%UNPACK%\runtimes\win-x64\native\WebView2Loader.dll" "%HERE%lib\" >nul
rmdir /s /q "%UNPACK%"
del "%PKG%"
exit /b 0
