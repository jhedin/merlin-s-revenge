property ancestor, pUnstickSpell
global g, gGameView, gGameName

on new me
  ancestor = new(script("objAiAttack"))
  return me
end

on init me, params
  ancestor.init(params)
  pUnstickSpell = 0
end

on finish me
  ancestor.finish()
end

on initCharacterInfo me, characterPrg, spr, params
  ancestor.initCharacterInfo(characterPrg, spr, params)
  me.goMode(#playerControl)
end

on attackFin me, reason
  case reason of
    #completed:
      me.goMode(#playerControl)
      me.pCharacterPrg.goMode(#walk)
  end case
  ancestor.attackFin(reason)
end

on characterModeChanged me, newCharMode
  case newCharMode of
    #dazed, #die:
      me.goMode(#dazed)
  end case
end

on getTarget me
  return #notApplicableToPlayer
end

on getTargetLoc me
  return g.mouseMaster.getMouseLoc()
end

on goMode me, newMode
  if me.getMode() = #freeze then
    pUnstickSpell = 1
  end if
  ancestor.goMode(newMode)
end

on internalEvent me, theEvent
  case theEvent of
    #buildingFinished:
      me.goMode(#playerControl)
    #spellCharged:
      if me.pCharacterPrg.getGmgOn() then
        if me.getAttack().gmgAutoFire then
          me.playerAttackRelease()
          me.playerAttackCharge()
        end if
      end if
    #gmgTurnedOn:
      me.playerAttackRelease()
    #gmgTurnedOff:
      me.playerAttackRelease()
      me.playerAttackCharge()
  end case
end

on interpretCheatKeys me
  if g.keyMaster.getKeyResult(#invincibility) then
    g.gamemaster.cheat(#invincibility)
  end if
  if g.keyMaster.getKeyResult(#killall) then
    g.gamemaster.cheat(#killall)
  end if
  if g.keyMaster.getKeyResult(#medikit) then
    g.gamemaster.cheat(#medikit)
  end if
  if g.keyMaster.getKeyResult(#testHit) then
    me.pCharacterPrg.flickWhite()
  end if
end

on interpretGameKeys me
  if g.keyMaster.getKeyResult(#escape) then
    g.gamemaster.escapePressed()
  end if
  if g.keyMaster.getKeyResult(#wizard) then
    me.pCharacterPrg.summonWizard()
  end if
  if g.keyMaster.getKeyResult(#gmg) then
    me.pCharacterPrg.setGmg()
  end if
  if g.keyMaster.getKeyResult(#army) then
    me.pCharacterPrg.summonArmy()
  end if
  if g.keyMaster.getKeyResult(#spell1) then
    me.pCharacterPrg.selectSpell(1)
  end if
  if g.keyMaster.getKeyResult(#spell2) then
    me.pCharacterPrg.selectSpell(2)
  end if
  if g.keyMaster.getKeyResult(#spell3) then
    me.pCharacterPrg.selectSpell(3)
  end if
  if g.keyMaster.getKeyResult(#spell4) then
    me.pCharacterPrg.selectSpell(4)
  end if
  if g.keyMaster.getKeyResult(#spell5) then
    me.pCharacterPrg.selectSpell(5)
  end if
  if g.keyMaster.getKeyResult(#spell6) then
    me.pCharacterPrg.selectSpell(6)
  end if
  if g.keyMaster.getKeyResult(#spell7) then
    me.pCharacterPrg.selectSpell(7)
  end if
  if g.keyMaster.getKeyResult(#spell8) then
    me.pCharacterPrg.selectSpell(8)
  end if
  if g.keyMaster.getKeyResult(#spell9) then
    me.pCharacterPrg.selectSpell(9)
  end if
  if g.keyMaster.getKeyResult(#weaponSelector) then
    me.pCharacterPrg.displayWeaponSelector()
  end if
  if g.keyMaster.getKeyResult(#wizardSelector) then
    me.pCharacterPrg.selectNextWizard()
  end if
end

on interpretMouse me
  mouseState = g.mouseMaster.getMouseState()
  case gGameName of
    #merlin_3:
      if me.pmode = #freeze then
        case mouseState of
          #pressed, #released:
            me.pCharacterPrg.AIisTryingToMove()
        end case
      else
        case mouseState of
          #notPressed:
            nothing()
          #pressed:
            me.playerAttackCharge()
          #released:
            me.playerAttackRelease()
        end case
      end if
  end case
end

on interpretMoveKeys me
  moveVector = g.keyMaster.getMoveVector()
  if me.pmode = #freeze then
    if moveVector <> point(0, 0) then
      me.pCharacterPrg.AIisTryingToMove()
    end if
    moveVector = point(0, 0)
  end if
  me.pCharacterPrg.moveHoriz(moveVector[1])
  me.pCharacterPrg.moveVert(moveVector[2])
  me.recordMoveVector(moveVector)
end

on playerAttackCharge me
  if me.pmode = #freeze then
    me.pCharacterPrg.AIisTryingToMove()
    return 
  end if
  me.attack()
end

on playerAttackRelease me
  attackType = me.getAttack().type
  case attackType of
    #melee, #ranged:
      nothing()
    #magic:
      targetloc = me.getTargetLoc()
      me.releaseMagic(targetloc)
  end case
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pUnstickSpell = 1
end

on restorePlayerControl me
  me.goMode(#playerControl)
end

on start me
  ancestor.start()
  me.goMode(#beBuilt)
end

on unpaws me
  ancestor.unpaws()
  me.unstickCurrentSpell()
end

on unstickCurrentSpell me
  playerMode = me.pCharacterPrg.getMode()
  if playerMode = #charge then
    g.mouseMaster.checkMouse()
    mouseState = g.mouseMaster.getMouseState()
    if (mouseState = #released) or (mouseState = #notPressed) then
      me.playerAttackRelease()
    end if
  end if
end

on update me
  if pUnstickSpell = 1 then
    me.unstickCurrentSpell()
    pUnstickSpell = 0
  end if
  case me.pmode of
    #attack, #playerControl, #freeze, #release:
      me.interpretMoveKeys()
      me.interpretCheatKeys()
      me.interpretGameKeys()
      me.interpretMouse()
  end case
  ancestor.update()
end
