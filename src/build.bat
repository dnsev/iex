@echo off
color



:: Compile
call :compile "" "" annotations annotation-editor || goto :error
echo.
call :compile ".lite" " (lite)" || goto :error



:: Done
goto :eof



:: Compile
:compile

set VERSION=%1
set VERSION_FULL=%2
set DEST_META=..\builds\iex%VERSION%.meta.js
set DEST=..\builds\iex%VERSION%.user.js

call :get_features %*

:: Meta building
python all_in_one.py iex.dev.user.js iex.meta.js -nosep -meta -version %VERSION_FULL%

:: Main
python all_in_one.py      iex.dev.user.js    iex.user.js -nosep -version %VERSION_FULL%
python replace.py         iex.user.js        iex.build1.user.js
python de_debug.py        iex.build1.user.js iex.build2.user.js
python features.py        iex.build2.user.js iex.build3.user.js %FEATURES%
python string_compress.py iex.build3.user.js iex.build4.user.js

node build_validator.js iex.build4.user.js || exit /B 1

:: Delete, copy, and cleanup
del %DEST_META% > NUL 2> NUL
del %DEST% > NUL 2> NUL

copy iex.meta.js ..\builds\iex%VERSION%.meta.js > NUL 2> NUL
copy iex.build4.user.js ..\builds\iex%VERSION%.user.js > NUL 2> NUL

del iex.meta.js > NUL 2> NUL

del iex.user.js > NUL 2> NUL
del iex.build1.user.js > NUL 2> NUL
del iex.build2.user.js > NUL 2> NUL
del iex.build3.user.js > NUL 2> NUL
del iex.build4.user.js > NUL 2> NUL

exit /B 0

goto :eof



:: Get features from arguments
:get_features

set FEATURES=
shift
shift

if "%~1" neq "" (
	set FEATURES=%1
	shift
)

:get_features_loop
if "%~1" neq "" (
	set FEATURES=%FEATURES% %1
	shift
	goto :get_features_loop
)

goto :eof



:: Error
:error
color c
echo Something went wrong while building
goto :eof


