property ancestor, pSpr

on new me
  me.ancestor = new(script("objTransformer"))
  i = me.modifyParams(#init)
  i.callingPrgMessage = #transWidthFin
  i[#spr] = #none
  return me
end

on init me, params
  pSpr = params.spr
  params.initialValue = pSpr.width
  me.ancestor.init(params)
end

on updateAttribute me
  pSpr.width = me.pCurr
end
