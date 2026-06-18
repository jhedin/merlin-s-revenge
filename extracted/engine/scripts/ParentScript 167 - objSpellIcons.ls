property ancestor, pSpellToAttachTo, pSpellStrip, pUnitAvailableBlend, pUnitNotAvailableBlend

on new me
  ancestor = new(script("objAutoUpdate"))
  i = me.modifyParams(#init)
  i[#spellStrip] = #none
  i[#spellToAttachTo] = #none
  me.addModule("modAnimSet")
  me.addModule("modFader")
  me.addModule("modSprite")
  return me
end

on addModParams me
  ancestor.addModParams()
  i = me.modifyParams(#init)
  i.character = #spellIcons
  i.name = "spellIcons"
end

on init me, params
  ancestor.init(params)
  pSpellToAttachTo = params.spellToAttachTo
  pSpellStrip = params.spellStrip
  pUnitAvailableBlend = 100
  pUnitNotAvailableBlend = 50
  me.calcStart()
  me.pauseAnim()
  me.setLocZ(pSpellToAttachTo.getLocZ() + 1)
end

on displayIconNumber me, theNum, available
  me.gotoAnimFrame(theNum)
  me.frameAdvance()
  if available then
    me.setBlend(pUnitAvailableBlend)
  else
    me.setBlend(pUnitNotAvailableBlend)
  end if
end

on explode me
  me.startQuickFade()
end

on finishConditionMet me
  return 0
end

on getAnimSym me, theSym
  return pSpellStrip
end

on update me
  ancestor.update()
  spellRect = pSpellToAttachTo.getRect()
  me.big.setRect(spellRect)
  spellLoc = pSpellToAttachTo.getLoc()
  me.big.setLoc(spellLoc)
end
