on CastMakeNameKey theCastNum, memberType
  theKey = [:]
  nummem = the number of castMembers of castLib theCastNum
  repeat with mem = 1 to nummem
    nextMem = member(mem, theCastNum)
    if nextMem.type = memberType then
      memSym = symbol(nextMem.name)
      theKey[memSym] = nextMem
    end if
  end repeat
  return theKey
end
