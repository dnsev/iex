python all_in_one.py iex.dev.user.js iex.meta.js -nosep -meta

python all_in_one.py iex.dev.user.js iex.user.js -nosep

replace.py iex.user.js iex.final.user.js

del iex.user.js
ren iex.final.user.js iex.user.js

move iex.meta.js ..\builds\
move iex.user.js ..\builds\

