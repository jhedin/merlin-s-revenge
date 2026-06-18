global gIntroPutted, gLastError

on alertHook me, err, msg, var1, var2
  the debugPlaybackEnabled = 1
  if gIntroPutted = VOID then
    put "Oops! The game has crashed!"
    put "To file a bug report please go to"
    put "http://www.themetalbox.com/bugs"
    put "(You will need a seperate account)"
    put "Please give as much detail as possible as to how to replicate this bug when reporting."
    put "Additionally, please cut and paste any error message(s) that appear below the dotted line."
    put "Thanks! Steve"
    put "---------------------------"
    gIntroPutted = 1
  end if
  if gLastError = (err && msg & ". Error in" && var1) then
    halt()
  else
    gLastError = err && msg & ". Error in" && var1
    put gLastError
  end if
  return 1
end
