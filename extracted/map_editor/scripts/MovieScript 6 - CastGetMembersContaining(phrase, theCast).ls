on CastGetMembersContaining phrase, theCast
  memList = []
  numMembers = the number of castMembers of castLib theCast
  repeat with i = 1 to numMembers
    nMem = member(i, theCast)
    if nMem.name contains phrase then
      memList.append(nMem)
    end if
  end repeat
  return memList
end
