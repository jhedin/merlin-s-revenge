on StringExtractList theString, theDelimiter
  thelist = []
  firstChar = 1
  repeat with i = 1 to theString.chars.count
    nChar = theString.char[i]
    if (nChar = theDelimiter) or (i = theString.chars.count) then
      lastChar = i - 1
      if lastChar < firstChar then
        next repeat
        next repeat
      end if
      nData = theString.char[firstChar..lastChar]
      thelist.append(nData)
      firstChar = i + 1
    end if
  end repeat
  return thelist
end
