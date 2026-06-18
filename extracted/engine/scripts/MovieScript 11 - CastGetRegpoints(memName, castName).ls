on CastGetRegpoints memname, castname
  thelist = []
  nummem = the number of castMembers of castLib castname
  repeat with mem = 1 to nummem
    nextMem = member(mem, castname)
    if nextMem.name contains memname then
      thelist.append(nextMem.regPoint)
    end if
  end repeat
  return thelist
end
