on StringRemoveLocZ theString
  pos = offset("_locz", theString)
  if pos > 0 then
    theString = theString.char[1..pos - 1]
  end if
  return theString
end
