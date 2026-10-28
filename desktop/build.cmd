@echo off
rem Builds the desktop buddy into build\ with the C# compiler that ships with Windows.
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set HERE=%~dp0
if not exist "%HERE%build" mkdir "%HERE%build"
"%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /out:"%HERE%build\MoodBuddy.exe" /r:"%HERE%lib\Microsoft.Web.WebView2.Core.dll" /r:"%HERE%lib\Microsoft.Web.WebView2.WinForms.dll" /r:System.Windows.Forms.dll /r:System.Drawing.dll "%HERE%MoodBuddy.cs" || exit /b 1
copy /y "%HERE%lib\*.dll" "%HERE%build\" >nul
copy /y "%HERE%index.html" "%HERE%build\" >nul
copy /y "%HERE%renderer.js" "%HERE%build\" >nul
echo Built %HERE%build\MoodBuddy.exe
