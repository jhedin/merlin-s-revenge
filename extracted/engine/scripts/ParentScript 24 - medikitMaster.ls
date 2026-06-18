property pLoc, pMedikitDisplayer
global g

on new me
  return me
end

on init me
  pLoc = point(0, 0)
  pMedikitDisplayer = #none
end

on finish me
  if (ilk(pMedikitDisplayer) <> #void) and (pMedikitDisplayer <> #none) then
    pMedikitDisplayer.finish()
    pMedikitDisplayer = #none
  end if
end

on start me, theloc
  pLoc = theloc
  pMedikitDisplayer = g.objectMaster.requestObject(#objMedikitDisplayer)
  params = pMedikitDisplayer.getParams(#init)
  params.displayLoc = theloc
  params.offMember = member("medikit_off", "gfx")
  params.onMember = member("medikit_on", "gfx")
  pMedikitDisplayer.init(params)
end

on stop me
  me.finish()
end

on updateDisplay me, theObj
  pMedikitDisplayer.updateDisplayFromObj(theObj)
end
