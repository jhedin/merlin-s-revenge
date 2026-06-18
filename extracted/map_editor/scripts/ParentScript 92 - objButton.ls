property ancestor, pBaseColor, pCaller, pCommSym, pParamsCopy, pHiColor, pMouseIn, pMouseDown, pName, pPulse, pSpr, pMemberType, pTransColor, pTransColorFin
global g

on new me
  me.ancestor = new(script("objAutoUpdate"))
  i = me.modifyParams(#init)
  i[#baseColor] = rgb(255, 255, 0)
  i[#callingPrg] = #none
  i[#commSym] = #none
  i[#hiColor] = rgb(255, 255, 255)
  i[#pulse] = 0
  i[#spr] = #none
  return me
end

on init me, params
  pParamsCopy = params
  pCaller = params.callingPrg
  pCommSym = params.commSym
  pBaseColor = params.baseColor
  pHiColor = params.hiColor
  pSpr = params.spr
  pMemberType = pSpr.member.type
  pMouseIn = 0
  pMouseDown = 0
  pName = pSpr.member.name
  pPulse = params.pulse
  if pCommSym = #none then
    pCommSym = symbol(pName)
  end if
  pTransColorFin = 1
  me.setColour(pBaseColor)
  ancestor.init(params)
end

on activate me
  ancestor.init(pParamsCopy)
  me.calcStart()
end

on checkclick me
  click = 0
  if pMouseDown and the mouseUp then
    click = 1
  end if
  pMouseDown = the mouseDown
  return click
end

on finish me
  if pTransColorFin = 0 then
    pTransColor.cancel()
  end if
  me.ancestor.finish()
end

on informCallingPrg me
  nothing()
end

on mouseEnter me
  me.transColor(#hi)
end

on mouseLeave me
  me.transColor(#base)
end

on setColour me, theColor
  if pMemberType = #text then
    pSpr.member.color = theColor.duplicate()
  else
    pSpr.color = theColor.duplicate()
  end if
end

on transColor me, Dir
  if pTransColorFin = 0 then
    pTransColor.cancel()
  end if
  pTransColor = g.objectMaster.requestObject(#objTransColor)
  params = pTransColor.getParams(#init)
  params.callingPrg = me
  params.spr = pSpr
  params.transformTarget = pMemberType
  params.pingpong = pPulse
  case Dir of
    #hi:
      params.targetColor = pHiColor.duplicate()
      if pPulse then
        params.speed = 15
      else
        params.speed = 35
      end if
    #base:
      params.targetColor = pBaseColor.duplicate()
      params.pingpong = 0
      if pPulse then
        params.speed = 15
      else
        params.speed = 5
      end if
  end case
  pTransColor.init(params)
  pTransColorFin = 0
end

on transformFin me
  pTransColorFin = 1
end

on update me
  if inside(the mouseLoc, pSpr.rect) then
    if pMouseIn = 0 then
      me.mouseEnter()
      pMouseIn = 1
    end if
    if me.checkclick() then
      pCaller.buttClicked(pCommSym)
    end if
  else
    if pMouseIn = 1 then
      me.mouseLeave()
      pMouseIn = 0
    end if
  end if
end
