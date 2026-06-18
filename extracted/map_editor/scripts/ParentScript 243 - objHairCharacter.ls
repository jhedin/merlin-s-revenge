property ancestor, pDownChain, pGrowHair, pGrowHairNum, pGrowHairTarget, pHairDropTextMember, pHairDropCounter, pHairOffset, pHairLength, pUpChain
global g

on new me
  ancestor = new(script("objCharacter"))
  i = me.pParams.init
  i[#hairDropTarget] = 5
  i[#hairLength] = 4
  return me
end

on init me, params
  ancestor.init(params)
  pDownChain = #none
  pGrowHair = 0
  pGrowHairNum = 0
  pGrowHairTarget = 2
  pHairDropTextMember = member("hairDrop_text", "gfx")
  pHairDropCounter = CounterNew()
  pHairDropCounter.tim[2] = params.hairDropTarget
  pHairOffset = point(-7, -9)
  pHairLength = params.hairLength
  me.initHair(me, pHairLength)
end

on initHair me
  repeat with i = 1 to pHairLength
    me.growHair()
  end repeat
end

on checkHairCollisions me, therect, minCollisionSpeed
  if pDownChain = #none then
    return 0
  else
    return pDownChain.checkHairCollisions(therect, minCollisionSpeed)
  end if
end

on checkHairCollisionsObj me, theloc
  if pDownChain = #none then
    return #none
  else
    return pDownChain.checkHairCollisionsObj(theloc)
  end if
end

on downChainGone me
  pDownChain = #none
end

on getHairLoc me
  hairOffset = pHairOffset.duplicate()
  if me.pSpr.flipH then
    hairOffset[1] = hairOffset[1] * -1
  end if
  hairLoc = me.getLoc() + hairOffset
  return hairLoc
end

on getHalfWayHair me
  hairLength = me.getHairLength()
  halfWay = hairLength / 2
  hairObj = me.getHairAtPos(halfWay)
  return hairObj
end

on getHairAtPos me, thePos
  if (thePos = 0) or (pDownChain = #none) then
    return #none
  else
    return pDownChain.getHairAtPos(thePos, 0)
  end if
end

on getHairLength me, len
  if pDownChain = #none then
    return 0
  else
    return pDownChain.getHairLength(0)
  end if
end

on growHair me
  if pDownChain = #none then
    pDownChain = g.actorMaster.newActor(#hair, me.getHairLoc())
    pDownChain.setUpChain(me)
    pDownChain.setPosInChain(1)
  else
    pDownChain.growHair()
  end if
end

on growHairSequence me
  pGrowHairNum = pGrowHairNum + 1
  me.flashWhite()
  pGrowHair = 1
end

on growHairSequencePass me
  repeat with i = 1 to pGrowHairNum
    if pDownChain = #none then
      me.growHair()
      next repeat
    end if
    pDownChain.growHairSequence()
  end repeat
  pGrowHairNum = 0
end

on hairDropCollected me
  if pHairDropCounter.fin then
    me.growHairSequence()
  else
    me.flashWhite()
  end if
  pHairDropTextMember.text = string(pHairDropCounter.theCount)
  counter(pHairDropCounter)
end

on trimHair me
  if pDownChain = #none then
  else
    pDownChain.trimHair()
  end if
end

on update me
  if pGrowHair = pGrowHairTarget then
    me.growHairSequencePass()
    pGrowHair = 0
  else
    if pGrowHair > 0 then
      pGrowHair = pGrowHair + 1
    end if
  end if
  ancestor.update()
end
