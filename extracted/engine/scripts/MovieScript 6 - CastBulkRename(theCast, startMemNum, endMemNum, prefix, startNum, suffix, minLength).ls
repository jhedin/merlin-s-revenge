on CastBulkRename theCast, startMemNum, endMemNum, prefix, suffix, startNum, minLength
  if voidp(startNum) then
    startNum = 1
  end if
  if voidp(suffix) then
    suffix = EMPTY
  end if
  if voidp(minLength) then
    minLength = 2
  end if
  currentNum = startNum
  repeat with memNum = startMemNum to endMemNum
    stringnum = string(currentNum)
    stringnum = StringAddChars(stringnum, minLength, 1, "0")
    newName = prefix & stringnum & suffix
    member(memNum, theCast).name = newName
    currentNum = currentNum + 1
  end repeat
end
