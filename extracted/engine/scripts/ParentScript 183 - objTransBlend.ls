property ancestor, pSpr

on new me
  me.ancestor = new(script("objTransformer"))
  i = me.modifyParams(#init)
  i[#spr] = #none
  return me
end

on init me, params
  pSpr = params.spr
  params.initialValue = pSpr.blend
  me.ancestor.init(params)
end

on informCallingPrg me
  callingPrg = me.getCallingPrg()
  if callingPrg <> #none then
    callingPrg.transBlendFin(me.id.bigMe)
  end if
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.updateAttribute()
end

on setSprite me, theSprite
  pSpr = theSprite
end

on updateAttribute me
  pSpr.blend = me.pCurr
end
