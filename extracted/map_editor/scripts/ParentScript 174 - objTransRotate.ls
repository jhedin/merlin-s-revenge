property ancestor, pSpr

on new me
  ancestor = new(script("objTransformer"))
  i = me.modifyParams(#init)
  i[#spr] = #none
  return me
end

on init me, params
  pSpr = params.spr
  params.initialValue = pSpr.rotation
  me.ancestor.init(params)
  me.setTarget(360)
end

on cancel me
  pSpr.rotation = 0
  ancestor.cancel()
end

on finishConditionMet me
  if ancestor.finishConditionMet() then
    me.setCurrent(0)
  end if
  return 0
end

on updateAttribute me
  pSpr.rotation = me.pCurr
end
