property pCopyProtectionURL, pmode, pNetRequest
global g, gCopyProtectionContent, gCopyProtectionPage

on new me
  return me
end

on init me
  pCopyProtectionURL = me.calcCopyProtectionURL()
  pNetRequest = #none
end

on finish me
  if (ilk(pNetRequest) <> #void) and (pNetRequest <> #none) then
    pNetRequest.finish()
    pNetRequest = #none
  end if
end

on calcCopyProtectionURL me
  theurl = URLOfPage(gCopyProtectionPage)
  return theurl
end

on getMode me
  return pmode
end

on netRequestFinished me, theNetPrg, theResult
  if theResult = gCopyProtectionContent then
    copyProtectionStatus = #Ok
  else
    copyProtectionStatus = #invalid
  end if
  g.gamemaster.updateCopyProtectionStatus(copyProtectionStatus)
end

on startCopyProtectionCheck me
  if pNetRequest = #none then
    pNetRequest = g.objectMaster.requestObject(#objNetRequest)
    params = pNetRequest.getParams(#init)
    params.callingPrg = me
    params.requestURL = pCopyProtectionURL
    pNetRequest.init(params)
  end if
end

on start me
end

on stop me
  me.finish()
end
