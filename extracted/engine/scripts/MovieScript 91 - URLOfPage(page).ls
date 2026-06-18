on URLOfPage thePage
  theurl = EMPTY
  if the runMode contains "Plugin" then
    theurl = the moviePath & thePage
  else
    theurl = "http://localhost/themetalbox_08a/_website/dcr/games/" & thePage
  end if
  return theurl
end
