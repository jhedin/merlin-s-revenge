on StringAddChars theString, numofchars, addtostart, theChar
  if theChar = VOID then
    theChar = " "
  end if
  thelenth = theString.chars.count
  charstoadd = numofchars - thelenth
  if charstoadd > 0 then
    repeat with ch = 1 to charstoadd
      if addtostart then
        theString = theChar & theString
        next repeat
      end if
      theString = theString & theChar
    end repeat
  end if
  return theString
end
