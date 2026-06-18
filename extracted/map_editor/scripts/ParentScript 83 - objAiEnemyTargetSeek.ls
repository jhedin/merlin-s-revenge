property ancestor, pAction, pTargetObj, pTargetType

on new me
  ancestor = new(script("objAiEnemy"))
  return me
end

on init me, player
  ancestor.init(player)
  pAction = #none
  pTargetType = #none
end

on characterModeChanged me, newMode
  case newMode of
    #look:
      me.refreshTarget()
  end case
  ancestor.characterModeChanged(newMode)
end

on goMode me, newMode
  case newMode of
    #attack:
      newMode = me.targetFound()
  end case
  ancestor.goMode(newMode)
end

on refreshTarget me
  case pTargetType of
    #playerHair:
      pTargetObj = me.pPlayer.getHalfWayHair()
  end case
end

on setAction me, newVal
  pAction = newVal
end

on setTargetType me, newVal
  pTargetType = newVal
  me.refreshTarget()
end

on targetFound me, newMode
  case pAction of
    #none, #attack:
      nothing()
    #attach:
      me.pCharacterPrg.attachTo(pTargetObj)
      newMode = #attach
  end case
  return newMode
end

on updateMoveToAttack me
  if pTargetObj <> #none then
    targetRect = pTargetObj.getRect()
    targetRect = targetRect.inflate(me.pAttack.reach[1], me.pAttack.reach[2])
    return me.updateMoveToRect(targetRect)
  else
    me.refreshTarget()
    return 0
  end if
end
