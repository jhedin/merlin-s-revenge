property ancestor, pAnimKeepSize, pAnimPaused, pAnimSet
global g, gGameView

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  pAnimKeepSize = 0
  pAnimPaused = 0
  pAnimSet = g.objectMaster.requestObject(#objAnimSet)
  pAnimSet.init(params.name, params.character)
  ancestor.init(params)
end

on addModParams me
  i = me.modifyParams(#init)
  i[#name] = EMPTY
  i[#character] = #none
  ancestor.addModParams()
end

on finish me
  if (pAnimSet <> #none) and (me.big.getMode() = #finish) then
    pAnimSet.finish()
    pAnimSet = #none
  end if
  ancestor.finish()
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  me.addToSaveData(sd)
end

on addToArmyDetails me
  ad = me.big.getArmyDetails()
  me.addToSaveData(ad)
end

on addToSaveData me, sd
  sd[#pAnimKeepSize] = pAnimKeepSize
  sd[#pAnimPaused] = pAnimPaused
  saveData = [:]
  pAnimSet.addSaveData(saveData)
  sd[#pAnimSet] = saveData
end

on frameAdvance me
  me.updateAnim()
  me.id.bigMe.animUpdated()
  me.internalEvent(#animUpdated)
end

on frameExtendDelay me, delayAmount
  pAnimSet.extendDelay(me.big.getAnimSym(#none), delayAmount)
end

on animUpdated me
end

on getAnimSym me, sym
  if sym = #none then
    sym = me.id.bigMe.getMode()
  end if
  case sym of
    #build:
      if me.big.checkMyBuildingInRange() = 0 then
        sym = #walk
      end if
    #fall:
      sym = #jump
    #landed, #moveToLoc:
      sym = #walk
    #look:
      sym = #stand
    #dead, #finish, #reelSit:
      sym = #grave
  end case
  if sym = #walk then
    if me.big.getMoving() = 0 then
      sym = #stand
    end if
  end if
  if me.big.getGmgOn() <> 1 then
    if sym = #charge then
      if me.big.getMoving() then
        sym = #chargewalk
      end if
    end if
    if sym = #release then
      if me.big.getMoving() then
        sym = #releasewalk
      end if
    end if
  else
    if me.big.getMoving() then
      sym = #weaponMagicWalk
    else
      sym = #weaponMagic
    end if
  end if
  return sym
end

on getAnimFrame me
  return pAnimSet.getFrame(me.id.bigMe.getAnimSym(#none))
end

on getAnimFrameFresh me
  return pAnimSet.getFrameFresh(me.id.bigMe.getAnimSym(#none))
end

on getAnimImage me
  return pAnimSet.getImage(me.big.getAnimSym(#none))
end

on getAnimImageFromStrip me, animSym
  return pAnimSet.getImage(animSym)
end

on getAnimKeepSize me
  return pAnimKeepSize
end

on getAnimLooped me
  if pAnimSet = #none then
    return 1
  end if
  return pAnimSet.getLooped(me.id.bigMe.getAnimSym(#none))
end

on getAnimMember me
  return pAnimSet.getCurrentMember(me.big.getAnimSym(#none))
end

on getAnimMemberFromStrip me, animSym
  return pAnimSet.getCurrentMember(animSym)
end

on getAnimMemberFromStripAt me, animSym, frameNo
  return pAnimSet.getMemberAt(animSym, frameNo)
end

on getNoOfFramesInStrip me, animSym
  return pAnimSet.getNoOfFrames(animSym)
end

on gotoAnimFrame me, frameNum
  return pAnimSet.gotoAnimFrame(me.big.getAnimSym(#none), frameNum)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #addToArmyDetails:
      me.addToArmyDetails()
    #restoreFromArmyDetails:
      me.restoreFromArmyDetails()
  end case
end

on pauseAnim me
  pAnimPaused = 1
end

on resetAnim me, animSym
  pAnimSet.resetAnim(animSym)
end

on restoreFromArmyDetails me
  ad = me.big.getArmyDetails()
  me.restoreFromSaveData(ad)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.restoreFromSaveData(sd)
end

on restoreFromSaveData me, sd
  pAnimKeepSize = sd.pAnimKeepSize
  pAnimPaused = sd.pAnimPaused
  pAnimSet.restoreFromSave(sd.pAnimSet)
end

on setAnimAllowStretching me, newVal
  me.setAnimKeepSize(newVal)
end

on setAnimKeepSize me, newVal
  pAnimKeepSize = newVal
end

on unpauseAnim me
  pAnimPaused = 0
end

on update me
  if pAnimPaused = 0 then
    me.frameAdvance()
  end if
  ancestor.update()
end

on updateAnim me
  sym = me.id.bigMe.getAnimSym(#none)
  member = pAnimSet.getMember(sym)
  SpriteSetMember(me.id.bigMe.getSprite(), member, #gameChar, pAnimKeepSize)
end
