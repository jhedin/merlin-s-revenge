on CastGetListNames theCast
  thelist = []
  nummem = the number of castMembers of castLib theCast
  repeat with mem = 1 to nummem
    nextMem = member(mem, theCast)
    thelist[mem] = nextMem.name
  end repeat
  return thelist
end
