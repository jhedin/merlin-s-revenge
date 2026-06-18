property ancestor, pSpr, pstartcolor, pTargetColor, pTransformTarget

on new me
  me.ancestor = new(script("objTransformer"))
  i = me.modifyParams(#init)
  i[#spr] = #none
  i[#transformTarget] = #text
  i[#targetColor] = rgb(255, 255, 0)
  i[#startColor] = #current
  i[#speed] = 10
  return me
end

on init me, params
  params.initialValue = 0
  me.ancestor.init(params)
  me.setTarget(100)
  pTargetColor = params.targetColor.duplicate()
  pTransformTarget = params.transformTarget
  pSpr = params.spr
  if params.startColor = #current then
    me.initCurrentColor(params)
  else
    pstartcolor = params.startColor.duplicate()
  end if
  me.setSpeed(params.speed)
end

on initCurrentColor me
  case pTransformTarget of
    #text:
      pstartcolor = pSpr.member.color.duplicate()
    #bitmap:
      pstartcolor = pSpr.color
  end case
end

on updateAttribute me
  newColor = varColRange(me.pCurr, pstartcolor, pTargetColor)
  case pTransformTarget of
    #text:
      pSpr.member.color = newColor
    #bitmap:
      pSpr.color = newColor
  end case
end
