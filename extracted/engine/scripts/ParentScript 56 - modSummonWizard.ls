property ancestor, pWizardOn, pWizardToSummon, pWizard, pWizards
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
  pWizardOn = 0
  pWizardToSummon = 1
  pWizard = #none
  pWizards = [:]
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  pWizards = g.wizardMaster.getWizards()
  sd[#pWizardOn] = pWizardOn
  sd[#pWizardToSummon] = pWizardToSummon
  sd[#pWizard] = pWizard
  sd[#pWizards] = pWizards
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #leaveGame:
      wizard = me.big.getRelation(pWizard)
      if wizard = theObj then
        pWizardOn = 0
        g.wizardMaster.wizardOff()
        me.big.setRelation(pWizard, #none)
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
  pWizardOn = sd.pWizardOn
  pWizardToSummon = sd.pWizardToSummon
  pWizard = sd.pWizard
  pWizards = sd.pWizards
  g.wizardMaster.setWizards(pWizards)
  if pWizards.count <> 0 then
    g.wizardMaster.setWizard(pWizards[pWizardToSummon])
  end if
end

on selectNextWizard me
  if (pWizards <> #none) and (pWizards <> #void) and (pWizards.count() <> 0) then
    if pWizardToSummon >= pWizards.count() then
      pWizardToSummon = 1
    else
      pWizardToSummon = pWizardToSummon + 1
    end if
    g.wizardMaster.setWizard(pWizards[pWizardToSummon])
  end if
end

on summonWizard me
  if pWizardOn then
    wizard = me.big.getRelation(pWizard)
    if wizard <> #none then
      wizard.armyTeleportOut()
      g.wizardMaster.wizardOff()
    end if
    return 
  end if
  fin = 0
  stopCheck = pWizardToSummon
  wizard = #none
  pWizards = g.wizardMaster.getWizards()
  if pWizards.count() = 0 then
    return 
  end if
  repeat while not fin
    pWizard = pWizards[pWizardToSummon].wizardSym
    wizardName = string(pWizard) & "InGame"
    wizardSym = symbol(wizardName)
    wizardDetails = g.armyMaster.lookupArmyDetails(me.big.getTeam(), wizardSym)
    if wizardDetails <> #none then
      pWizardOn = 1
      g.wizardMaster.wizardOn()
      wizard = g.armyMaster.createUnit(me.big.getTeam(), wizardSym, g.mouseMaster.getMouseLoc())
      fin = 1
      next repeat
    end if
    me.selectNextWizard()
    if stopCheck = pWizardToSummon then
      fin = 1
    end if
  end repeat
  if wizard <> #none then
    me.big.setRelation(pWizard, wizard)
    me.big.keepMePosted(wizard, #leaveGame, #once)
  else
    pWizardOn = 0
    g.wizardMaster.wizardOff()
  end if
end

on updateWizards me, wizards
  pWizards = wizards
end
