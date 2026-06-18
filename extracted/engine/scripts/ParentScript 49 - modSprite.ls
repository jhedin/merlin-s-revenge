property ancestor, pSpr
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pSpr = #none
  me.ensureSprite()
end

on finish me
  ancestor.finish()
  if pSpr <> #none then
    g.spriteMaster.freeSprite(pSpr)
    pSpr = #none
  end if
end

on ensureSprite me
  if pSpr = #none then
    pSpr = g.spriteMaster.requestSprite(me.big)
  end if
end

on getSprite me
  return pSpr
end

on setRect me, therect
  pSpr.rect = therect
end

on setLoc me, theloc
  pSpr.loc = theloc
end

on setLocZ me, theLocZ
  pSpr.locZ = theLocZ
end
