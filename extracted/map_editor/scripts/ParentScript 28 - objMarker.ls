property ancestor, pSpr
global g

on new me
  ancestor = new(script("objBasic"))
  me.init()
  return me
end

on init me
  pSpr = g.spriteMaster.requestSprite()
  SpriteSetMember(pSpr, member("markerBoundary", "gfx"))
end

on setRect me, therect
  pSpr.rect = therect
end
