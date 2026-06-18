property ancestor, pDieSound

on new me
  ancestor = new(script("objGameObject"))
  i = me.modifyParams(#init)
  i.flags.append(#objDwelling)
  me.addModule("modAnimSet")
  me.addModule("modConstruction")
  me.addModule("modEnergy")
  me.addModule("modExperience")
  me.addModule("modFlasher")
  me.addModule("modGhost")
  me.addModule("modGrave")
  me.addModule("modListNode")
  me.addModule("modReel")
  me.addModule("modRelationships")
  me.addModule("modResidents")
  me.addModule("modScale")
  me.addModule("modStarReleaser")
  i[#dieSound] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pDieSound = params.dieSound
end

on finish me
  ancestor.finish()
end

on die me
  ancestor.die()
  me.startDeath()
end

on flasherFinished me
  me.goMode(#finish)
  me.setDead(1)
  me.drawGrave()
  ancestor.flasherFinished()
end

on getAnimSym me, sym
  sym = ancestor.getAnimSym(sym)
  residentMode = me.getResidentMode()
  if residentMode = #produceGroup then
    sym = #produceGroup
  else
    case sym of
      #reel:
        sym = #stand
    end case
  end if
  return sym
end

on getAttack me
  attack = [:]
  attack[#type] = #melee
  return attack
end

on goMode me, newMode
  case newMode of
    #dead:
      me.PlaySound(pDieSound)
    #finish:
      me.setDead(1)
      me.drawGrave()
  end case
  ancestor.goMode(newMode)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #buildingFinished:
      me.startProduction()
    #reelFinished, #outOfEnergy:
      if me.checkDead() then
        me.startDeath()
      end if
  end case
end

on noMoreResidents me
  me.startDeath()
end

on reelFinished me
  if me.checkDead() then
    me.startDeath()
  end if
end

on start me
  ancestor.start()
  me.startBuilding()
end

on startDeath me
  if me.checkDead() = 0 then
    me.loseAllEnergy()
  end if
  me.goMode(#dead)
end

on takeHit me, collisionVect, attackingObj, owner
  if me.pmode <> #dead then
    if me.checkDead() = 0 then
      ancestor.takeHit(collisionVect, attackingObj, owner)
    end if
  end if
end

on update me
  ancestor.update()
  case me.pmode of
    #dead:
      fin = me.updateDead()
      if fin then
        me.goMode(#finish)
      end if
  end case
end

on updateDead me
  fin = me.getAnimLooped()
  if fin = 1 then
    nothing()
  end if
  return fin
end
