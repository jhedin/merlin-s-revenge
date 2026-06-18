property pLoc, pGmgDisplayer
global g

on new me
  return me
end

on init me
  pLoc = point(0, 0)
  pGmgDisplayer = #none
end

on finish me
  if (pGmgDisplayer <> VOID) and (pGmgDisplayer <> #none) then
    pGmgDisplayer.finish()
    pGmgDisplayer = #none
  end if
end

on start me, theloc
  pLoc = theloc
  pGmgDisplayer = g.objectMaster.requestObject(#objGmgDisplayer)
  params = pGmgDisplayer.getParams(#init)
  params.displayLoc = theloc
  params.offMember = member("gmg_off", "gfx")
  params.onMember = member("gmg_on", "gfx")
  pGmgDisplayer.init(params)
end

on stop me
  me.finish()
end

on updateDisplay me, theState
  pGmgDisplayer.updateActive(theState)
end
