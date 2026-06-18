on CastCopy fromCast, toCast
  CastDeleteAll(toCast)
  toCastName = castLib(toCast).name
  nummem = the number of castMembers of castLib fromCast
  repeat with i = 1 to nummem
    nFromMem = member(i, fromCast)
    nToMem = nFromMem.duplicate()
    nToMem = member(nToMem, fromCast)
    nToMem.move(member(i, toCastName))
  end repeat
end
