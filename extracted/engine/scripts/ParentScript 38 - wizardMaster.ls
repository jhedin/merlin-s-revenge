property pLoc, pWizardDisplayer, pwizardsFound, pSelectedWizard, pSummonMod
global g

on new me
  return me
end

on init me
  pLoc = point(0, 0)
  pWizardDisplayer = #none
  pwizardsFound = [:]
  pSummonMod = #none
end

on finish me
  if (ilk(pWizardDisplayer) <> #void) and (pWizardDisplayer <> #none) then
    pWizardDisplayer.finish()
    pWizardDisplayer = #none
  end if
end

on newWizardFound me, theWizard
  wizardSym = string(theWizard)
  totalLength = the number of chars in wizardSym
  wizardName = chars(wizardSym, 1, totalLength - 6)
  wizardSym = symbol(wizardName)
  pwizardsFound[wizardSym] = [:]
  pwizardsFound[wizardSym][#wizardSym] = wizardSym
  wizardBarPic = wizardName & "_off"
  pwizardsFound[wizardSym].addProp(#bar, member(wizardBarPic, "gfx"))
  wizardSelectorPic = wizardName & "_ws"
  pwizardsFound[wizardSym].addProp(#selector, member(wizardSelectorPic, "gfx"))
  if (pwizardsFound.count = 1) and (pSummonMod <> #none) then
    me.setWizard(pwizardsFound[wizardSym])
    pSummonMod.updateWizards(pwizardsFound)
    me.wizardOn()
  end if
end

on getWizards me
  return pwizardsFound.duplicate()
end

on registerMod me, theObj
  pSummonMod = theObj
end

on setWizard me, wizard
  pSelectedWizard = wizard.wizardSym
  me.updateDisplay(pwizardsFound[pSelectedWizard].bar)
end

on setWizards me, wizards
  pwizardsFound = wizards
end

on start me, theloc
  pLoc = theloc
  pWizardDisplayer = g.objectMaster.requestObject(#objWizardDisplayer)
  params = pWizardDisplayer.getParams(#init)
  params.displayLoc = theloc
  pWizardDisplayer.init(params)
end

on stop me
  me.finish()
end

on wizardOn me
  pWizardDisplayer.setWizardOn()
end

on wizardOff me
  pWizardDisplayer.setWizardOff()
end

on updateDisplay me, theObj
  pWizardDisplayer.updateDisplayFromObj(theObj)
end
