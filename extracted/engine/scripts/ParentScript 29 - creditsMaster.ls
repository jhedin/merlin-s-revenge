property pCreditsMember, pCreditsText, pCreditsURL, pLoadingMember, pLoadingTransBlend, pNetRequest, pTextScroller, pTextCreditsDefaultMember
global g, gCreditsPage

on new me
  return me
end

on init me
  pCreditsMember = member("CreditsFull", "gfx")
  pCreditsMember.text = EMPTY
  pCreditsText = #none
  pCreditsURL = URLOfPage(gCreditsPage)
  pLoadingMember = member("CreditsLoading", "gfx")
  pLoadingTransBlend = #none
  pNetRequest = #none
  pTextScroller = #none
  pTextCreditsDefaultMember = member("txt_credits", "gfx")
end

on finish me
  me.cancelLoadingTransBlend()
  if (ilk(pNetRequest) <> #void) and (pNetRequest <> #none) then
    pNetRequest.finish()
    pNetRequest = #none
  end if
  if (ilk(pTextScroller) <> #void) and (pTextScroller <> #none) then
    pTextScroller.cancel()
    pTextScroller = #none
  end if
  if ilk(pCreditsMember) <> #void then
    pCreditsMember.text = EMPTY
  end if
end

on cancelLoadingTransBlend me
  if (ilk(pLoadingTransBlend) <> #void) and (pLoadingTransBlend <> #none) then
    pLoadingTransBlend.cancel()
    pLoadingTransBlend = #none
  end if
end

on displayCreditsText me
  pCreditsMember.text = pCreditsText
  pCreditsMember.scrollTop = 0
  pTextScroller = g.objectMaster.requestObject(#objTransTextScroll)
  params = pTextScroller.getParams(#init)
  params.callingPrg = me
  params.speed = 1
  params.spr = g.spriteMaster.getSpriteWithMember(pCreditsMember)
  params.targetValue = pCreditsMember.height
  pTextScroller.init(params)
  pTextScroller.calcStart()
end

on fadeLoadingText me, targetValue
  me.cancelLoadingTransBlend()
  loadingSprite = g.spriteMaster.getSpriteWithMember(pLoadingMember)
  pLoadingTransBlend = g.objectMaster.requestObject(#objTransBlend)
  params = pLoadingTransBlend.getParams(#init)
  params.callingPrg = me
  params.spr = loadingSprite
  params.targetValue = targetValue
  pLoadingTransBlend.init(params)
  pLoadingTransBlend.calcStart()
end

on fadeDownLoadingText me
  me.fadeLoadingText(1)
end

on fadeUpLoadingText me
  me.fadeLoadingText(100)
end

on netRequestFinished me, theObj, theText
  if theObj = pNetRequest then
    pCreditsText = theText
    me.displayCreditsText()
    me.fadeDownLoadingText()
  end if
end

on requestCreditsText me
  if (pTextCreditsDefaultMember <> member(-1, 1)) and (pTextCreditsDefaultMember <> #none) then
    pCreditsText = pTextCreditsDefaultMember.text
    me.displayCreditsText()
    return 
  end if
  if pNetRequest = #none then
    pNetRequest = g.objectMaster.requestObject(#objNetRequest)
    params = pNetRequest.getParams(#init)
    params.callingPrg = me
    params.requestURL = pCreditsURL
    pNetRequest.init(params)
    me.fadeUpLoadingText()
  end if
end

on start me
  if pCreditsText <> #none then
    me.displayCreditsText()
  else
    me.requestCreditsText()
  end if
end

on stop me
  me.finish()
end

on transBlendFin me
  pLoadingTransBlend = #none
end

on transTextScrollFin me
  pTextScroller = #none
end
