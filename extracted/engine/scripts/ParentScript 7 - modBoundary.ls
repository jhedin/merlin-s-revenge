property ancestor, pBoundaryMember, pBoundarySprites
global g, gMapBoundary, gMapBoundaryLayer

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  ancestor.init(params)
  pBoundaryMember = params.boundaryMember
  pBoundarySprites = []
end

on addModParams me
  i = me.modifyParams(#init)
  i[#boundaryMember] = member("dot", "gfx")
  ancestor.addModParams()
end

on displayBoundary me
  pBoundarySprites = []
  repeat with i = 1 to 4
    spr = g.spriteMaster.requestSprite()
    SpriteSetMember(spr, pBoundaryMember)
    spr.locZ = gMapBoundaryLayer
    pBoundarySprites.append(spr)
  end repeat
  mapRect = me.id.bigMe.getSpriteRect()
  boundaryRect = inflate(mapRect, gMapBoundary, gMapBoundary)
  pBoundarySprites[1].rect = rect(boundaryRect.left, boundaryRect.top, boundaryRect.right, mapRect.top)
  pBoundarySprites[2].rect = rect(boundaryRect.left, boundaryRect.top, mapRect.left, boundaryRect.bottom)
  pBoundarySprites[3].rect = rect(boundaryRect.left, mapRect.bottom, boundaryRect.right, boundaryRect.bottom)
  pBoundarySprites[4].rect = rect(mapRect.right, boundaryRect.top, boundaryRect.right, boundaryRect.bottom)
end

on finish me
  repeat with spr in pBoundarySprites
    g.spriteMaster.freeSprite(spr)
  end repeat
  pBoundarySprites = []
  ancestor.finish()
end
