property ancestor, pBerlinOn
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pBerlinOn = 0
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pBerlinOn] = pBerlinOn
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #leaveGame:
      berlin = me.big.getRelation(#berlin)
      if berlin = theObj then
        pBerlinOn = 0
        me.big.setRelation(#berlin, #none)
      end if
  end case
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #noTargetFound:
      me.armyTeleportOut()
  end case
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pBerlinOn = sd.pBerlinOn
end

on summonBerlin me
  if pBerlinOn then
    berlin = me.big.getRelation(#berlin)
    if berlin <> #none then
      berlin.armyTeleportOut()
    end if
    return 
  end if
  berlin = #none
  berlinDetails = g.armyMaster.lookupArmyDetails(me.big.getTeam(), #berlinInGame)
  if berlinDetails <> #none then
    berlin = g.armyMaster.createUnit(me.big.getTeam(), #berlinInGame, g.mouseMaster.getMouseLoc())
  end if
  if berlin <> #none then
    pBerlinOn = 1
    me.big.setRelation(#berlin, berlin)
    me.big.keepMePosted(berlin, #leaveGame, #once)
  end if
end
