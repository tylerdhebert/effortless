@echo off
set ELECTRON_RUN_AS_NODE=1
"%~dp0node_modules\.bin\electron.exe" "%~dp0dist-cli\efl.js" %*
