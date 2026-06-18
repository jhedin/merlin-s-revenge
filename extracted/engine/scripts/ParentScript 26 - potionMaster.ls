property pAlign, pDisplayRect, pPotionsCollected, pTextVSpace, pTitle, pTitleColour, pTitleFont, pTitleText, pTitleVSpace
global g, gGlobalDisplayLayer

on new me
  return me
end

on init me
  pAlign = #right
  pDisplayRect = rect(0, 0, 1, 1)
  pPotionsCollected = []
  pTextVSpace = 3
  pTitle = #none
  pTitleColour = rgb(0, 0, 0)
  pTitleFont = #smallgrey
  pTitleText = "POTIONS DRUNK"
  pTitleVSpace = 5
end

on finish me
  if (pTitle <> #none) and ilk(pTitle, #object) then
    pTitle.finish()
    pTitle = #none
  end if
  me.clearPotionsCollected()
end

on addSaveData me, sd
  potionsCollected = []
  repeat with potionRecord in pPotionsCollected
    potionData = [:]
    potionData[#character] = potionRecord.character
    potionData[#colour] = potionRecord.colour
    potionData[#member] = potionRecord.member
    potionData[#numCollected] = potionRecord.numCollected
    potionsCollected.append(potionData)
  end repeat
  sd[#pPotionsCollected] = potionsCollected
end

on calcDisplayRect me, theloc, theMark
  x1 = theloc.locH
  y1 = theloc.locV
  x2 = x1 + theMark.width
  y2 = y1 + theMark.height
  therect = rect(x1, y1, x2, y2)
  return therect
end

on clearPotionsCollected me
  if not voidp(pPotionsCollected) then
    repeat with record in pPotionsCollected
      record.counter.finish()
      record.icon.finish()
    end repeat
  end if
  pPotionsCollected = []
end

on display me
  if pPotionsCollected.count = 0 then
    return 
  end if
  case pAlign of
    #right:
      me.displayAlignRight()
    #left:
      me.displayAlignLeft()
  end case
end

on displayAlignRight me
  xPos = pDisplayRect.right
  yPos = pDisplayRect.top
  repeat with i = pPotionsCollected.count down to 1
    potionRecord = pPotionsCollected[i]
    counter = potionRecord.counter
    counterWidth = counter.getDisplayWidth()
    xPos = xPos - counterWidth
    yPos = pDisplayRect.top + pTextVSpace
    counterPos = point(xPos, yPos)
    counter.setDisplayLoc(counterPos)
    counter.displayValue(potionRecord.numCollected)
    member = potionRecord.member
    icon = potionRecord.icon
    memberWidth = member.width
    xPos = xPos - memberWidth
    yPos = pDisplayRect.top
    iconPos = point(xPos, yPos)
    icon.displayImageAtLoc(member.image, iconPos)
  end repeat
  titleWidth = pTitle.getImageWidth()
  xPos = xPos - titleWidth
  yPos = pDisplayRect.top + pTitleVSpace
  titleLoc = point(xPos, yPos)
  pTitle.displayAtLoc(titleLoc)
end

on getPotionRecord me, thePotion
  potionCharacter = thePotion.getCharacter()
  pos = ListGetPosByProp(pPotionsCollected, #character, potionCharacter)
  if pos = 0 then
    newRecord = g.structMaster.getStruct(#potionRecord)
    newRecord.character = thePotion.getCharacter()
    newRecord.colour = thePotion.getCounterColour()
    newRecord.member = thePotion.getCounterMember()
    newRecord.numCollected = 0
    newRecord.counter = me.requestCounter(newRecord.colour)
    newRecord.icon = me.requestIcon()
    pPotionsCollected.append(newRecord)
    potionRecord = pPotionsCollected[pPotionsCollected.count]
  else
    potionRecord = pPotionsCollected[pos]
  end if
  return potionRecord
end

on potionCollected me, thePotion
  potionRecord = me.getPotionRecord(thePotion)
  potionRecord.numCollected = potionRecord.numCollected + 1
  me.display()
end

on requestCounter me, colour
  counter = g.objectMaster.requestObject(#objDisplayCounter)
  params = counter.getParams(#init)
  params.colour = colour
  counter.init(params)
  return counter
end

on requestIcon me
  icon = g.objectMaster.requestObject(#objSpriteMember)
  params = icon.getParams(#init)
  params.layer = gGlobalDisplayLayer
  icon.init(params)
  return icon
end

on restoreFromSave me, sd
  potionsCollected = sd.pPotionsCollected
  me.clearPotionsCollected()
  pPotionsCollected = []
  repeat with potionData in potionsCollected
    potionRecord = g.structMaster.getStruct(#potionRecord)
    potionRecord.character = potionData.character
    potionRecord.colour = potionData.colour
    potionRecord.member = potionData.member
    potionRecord.numCollected = potionData.numCollected
    potionRecord.counter = me.requestCounter(potionData.colour)
    potionRecord.icon = me.requestIcon()
    pPotionsCollected.append(potionRecord)
  end repeat
  me.display()
end

on start me, theloc, theMark
  pDisplayRect = me.calcDisplayRect(theloc, theMark)
  me.startTitle()
end

on startTitle me
  pTitle = g.objectMaster.requestObject(#objTextImage)
  params = pTitle.getParams(#init)
  params.colour = pTitleColour
  params.font = pTitleFont
  params.text = pTitleText
  pTitle.init(params)
end

on stop me
  me.finish()
end
