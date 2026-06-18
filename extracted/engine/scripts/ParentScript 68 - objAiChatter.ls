property ancestor, pPlayer
global g

on new me
  ancestor = new(script("objAi"))
  return me
end

on init me, params
  ancestor.init(params)
  pPlayer = g.actorMaster.getPlayer()
  me.goMode(#waitingToTalk)
end

on checkNavModeActive me
  player = g.actorMaster.getPlayer()
  navModeActive = player.getNavModeActive()
  return navModeActive
end

on checkPossibleToTalk me
  possible = 0
  talkOnlyOnNavMode = me.pCharacterPrg.getTalkOnlyOnNavMode()
  if talkOnlyOnNavMode and me.checkNavModeActive() then
    possible = 1
  end if
  if talkOnlyOnNavMode = 0 then
    possible = 1
  end if
  return possible
end

on update me
  case me.pmode of
    #waitingToTalk:
      if me.checkPossibleToTalk() then
        if me.pCharacterPrg.checkForCollisionWithPlayer() then
          me.pCharacterPrg.collected()
          me.goMode(#Active)
        end if
      end if
  end case
end
