on StringReplace theString, strToReplace, replacementString
  output = EMPTY
  lenth = strToReplace.length - 1
  repeat while theString contains strToReplace
    currOffset = offset(strToReplace, theString)
    output = output & strToReplace.char[1..currOffset]
    delete char -30000 of output
    output = output & replacementString
    delete theString.char[1..currOffset + lenth]
  end repeat
  output = output & theString
  return output
end
