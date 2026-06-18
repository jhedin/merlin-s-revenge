on new me
  return me
end

on init me
  numImages = the number of castMembers of castLib "temp"
  repeat with i = 1 to numImages
    member(i, "temp").erase()
  end repeat
end

on requestMember me, theType, thename
  imageMem = new(theType, castLib("temp"))
  if thename <> VOID then
    imageMem.name = thename
  end if
  return imageMem
end

on freeMember me, theMember
  theMember.erase()
end

on stop me
end
