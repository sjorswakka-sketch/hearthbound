@echo off
setlocal
cd /d "%~dp0"
title Hearthbound - Host a LAN game
echo This computer will host the shared game for your home network.
echo Friends on the same Wi-Fi or Ethernet open the address shown below.
echo Only the host needs this download. Keep this window open while playing.
echo.
call "%~dp0START-HEARTHBOUND.cmd" --lan %*
endlocal
