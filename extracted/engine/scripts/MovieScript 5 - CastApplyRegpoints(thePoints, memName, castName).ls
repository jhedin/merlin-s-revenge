global g

on CastApplyRegpoints thePoints, memname, castname
  thelist = g.objectMaster.requestObject(#objlist)
  thelist.init(thePoints)
  nummem = the number of castMembers of castLib castname
  repeat with mem = 1 to nummem
    nextMem = member(mem, castname)
    if nextMem.name contains memname then
      nextMem.regPoint = thelist.nextValue()
    end if
  end repeat
end
