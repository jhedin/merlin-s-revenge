on CastChangeLinkLocation theCast, newURL
  nummem = the number of castMembers of castLib theCast
  repeat with i = 1 to nummem
    nMem = member(i, theCast)
    if nMem.fileName = EMPTY then
      next repeat
    end if
    newFileName = newURL & nMem.name & ".ls"
    put newFileName
    nMem.fileName = newFileName
  end repeat
end
