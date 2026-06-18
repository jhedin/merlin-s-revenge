property pAnimData

on new me
  return me
end

on init me
  pAnimData = [:]
  animMembers = me.collectMembers()
  animMembers = me.seperateMembers(animMembers)
  me.extractData(animMembers)
end

on finish me
end

on addFrame me, theData, themem
  if pAnimData[theData[2]] = VOID then
    pAnimData[theData[2]] = [:]
  end if
  if pAnimData[theData[2]][theData[3]] = VOID then
    pAnimData[theData[2]][theData[3]] = []
  end if
  pAnimData[theData[2]][theData[3]].append([#mem: themem, #dela: theData[4]])
end

on collectMembers me
  animMembers = []
  nummem = the number of castMembers of castLib "gfx"
  repeat with i = 1 to nummem
    nMem = member(i, "gfx")
    nName = nMem.name
    if nName contains "anm_" then
      animMembers.append([#nam: nName, #mem: nMem])
    end if
  end repeat
  return animMembers
end

on extractData me, animMembers
  repeat with memData in animMembers
    data = StringExtractList(memData.nam, "_")
    data[2] = symbol(data[2])
    data[3] = symbol(data[3])
    data[4] = value(data[4])
    me.addFrame(data, memData.mem)
  end repeat
end

on getStripDefs me, charName
  charName = symbol(charName)
  return pAnimData[charName]
end

on seperateMembers me, animMembers
  i = 1
  repeat with animMember in animMembers
    nName = animMember.nam
    namList = StringExtractList(nName, " ")
    if namList.count > 1 then
      nMem = animMember.mem
      repeat with i = 2 to namList.count
        animMembers.append([#nam: namList[i], #mem: nMem])
      end repeat
    end if
    i = i + 1
  end repeat
  return animMembers
end

on stop me
  me.finish()
end
