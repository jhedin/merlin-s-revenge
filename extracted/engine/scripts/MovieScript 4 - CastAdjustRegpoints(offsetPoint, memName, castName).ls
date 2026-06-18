global g

on CastAdjustRegpoints offsetPoint, memname, castname
  nummem = the number of castMembers of castLib castname
  repeat with mem = 1 to nummem
    nextMem = member(mem, castname)
    if nextMem.name contains memname then
      nextMem.regPoint = nextMem.regPoint + offsetPoint
    end if
  end repeat
end
