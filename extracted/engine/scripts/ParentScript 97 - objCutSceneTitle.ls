property ancestor, pBackgroundColour, pDisplayTime, pDisplayTimer, pmode, pTitleColour, pTitleMember, pTitleToShow
global g

on new me
  ancestor = new(script("objSpriteMember"))
  me.addModule("modColourTransform")
  return me
end

on init me, params
  ancestor.init(params)
  pBackgroundColour = rgb(0, 0, 0)
  pDisplayTime = 150
  pDisplayTimer = #none
  pmode = #none
  pTitleColour = rgb(204, 204, 0)
  pTitleMember = params.spr.member
  pTitleMember.color = pBackgroundColour
end

on finish me
  me.setTitle(EMPTY)
  me.cancelDisplayTimer()
  if pTitleMember <> #none then
    pTitleMember = #none
  end if
  ancestor.finish()
end

on cancelDisplayTimer me
  if pDisplayTimer <> #none then
    pDisplayTimer.finish()
    pDisplayTimer = #none
  end if
end

on colourTransformFin me
  ancestor.colourTransformFin()
  case pmode of
    #fadeDown:
      me.setTitle(pTitleToShow)
      me.startDisplayTimer()
      me.revealTitle()
  end case
end

on displayTimerFinished me
  pDisplayTimer = #none
  me.hideTitle()
end

on hideTitle me
  me.startColourChange(pBackgroundColour)
  pmode = #none
end

on revealTitle me
  me.startColourChange(pTitleColour)
  pmode = #none
end

on setTitle me, theText
  pTitleMember.text = theText
end

on showTitle me, theText
  pTitleToShow = theText
  me.startColourChange(pBackgroundColour)
  pmode = #fadeDown
end

on startColourChange me, newColour
  params = me.getParams(#colourTransform)
  params.targetColor = newColour
  params.speed = 4
  me.colourTransform(params)
end

on startDisplayTimer me
  me.cancelDisplayTimer()
  pDisplayTimer = g.objectMaster.requestObject(#objTimer)
  params = pDisplayTimer.getParams(#init)
  params.callingPrg = me
  params.callingPrgMessage = #displayTimerFinished
  params.framesTime = pDisplayTime
  pDisplayTimer.init(params)
end
