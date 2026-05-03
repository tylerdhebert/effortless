@echo off
set ELECTRON_RUN_AS_NODE=1
"%~dp0effortless.exe" "%~dp0resources\cli\efl.js" %*
