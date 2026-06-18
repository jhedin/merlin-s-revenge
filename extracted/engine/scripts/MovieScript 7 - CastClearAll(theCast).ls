on CastDeleteAll theCast
  numMems = the number of castMembers of castLib theCast
  repeat with mem = 1 to numMems
    erase(member(mem, theCast))
  end repeat
end
