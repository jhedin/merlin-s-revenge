on StringToSymbol theString
  theString = StringCharReplace(theString, " ", "_")
  sym = symbol(theString)
  return sym
end
