@echo off

set chrome="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set base_dir=%~dp0
set target_dir="%base_dir%iex"

:: Setup
mkdir iex > nul 2> nul

:: Create
python crxmake.py %target_dir% ..\builds\iex.user.js iex.user.js manifest.json manifest.json updates_base.xml ..\builds\updates.xml -noicon

:: Copy icons
python ico.py icons %target_dir%

:: Build
%chrome% --pack-extension=%target_dir% --pack-extension-key=%target_dir%.pem --no-message-box || echo some error occured
::%chrome% --pack-extension=%target_dir% --no-message-box

:: Done
rmdir /S /Q %target_dir% > nul 2> nul

:: Move
move %target_dir%.crx ..\builds\