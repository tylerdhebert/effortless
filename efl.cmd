@echo off
set ELECTRON_RUN_AS_NODE=1
"%~dp0node_modules\.bin\electron.exe" --import tsx "%~dp0cli\efl.ts" %*
