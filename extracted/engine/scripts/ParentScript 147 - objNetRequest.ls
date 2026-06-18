property ancestor, pCallingPrg, pNetError, pNetID, pRequestURL
global g

on new me
  ancestor = new(script("objAutoUpdate"))
  i = me.modifyParams(#init)
  i[#callingPrg] = #none
  i[#NetID] = #none
  i[#requestURL] = EMPTY
  return me
end

on init me, params
  ancestor.init(params)
  pCallingPrg = params.callingPrg
  pRequestURL = params.requestURL
  pNetError = #none
  me.start()
end

on requestURL me
  pNetID = getNetText(pRequestURL)
  g.updater.addPrg(me.big, #hi)
end

on start me
  if pRequestURL <> EMPTY then
    me.requestURL()
  end if
end

on update me
  if netDone(pNetID) then
    pNetError = netError(pNetID)
    theResult = netTextResult(pNetID)
    pCallingPrg.netRequestFinished(me.big, theResult)
    g.updater.removePrg(me)
  end if
end
