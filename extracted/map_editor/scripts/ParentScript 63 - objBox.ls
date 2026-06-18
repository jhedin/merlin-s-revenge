property ancestor, pcolor, player, pLineWidth, pOffscreenRect, prect, pSprites
global g, gGridSelectorLayer

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#color] = rgb(255, 255, 0)
  i[#initialRect] = #none
  i[#layer] = gGridSelectorLayer
  i[#linewidth] = 1
  return me
end

on init me, params
  pOffscreenRect = rect(-1, -1, 0, 0)
  pcolor = params.color
  player = gGridSelectorLayer
  pLineWidth = params.linewidth
  pSprites = g.structMaster.getStruct(#boxSprites)
  me.requestSprites()
  if params.initialRect <> #none then
    me.setRect(params.initialRect)
  end if
end

on display me
  pSprites[#top].rect = rect(prect[1], prect[2], prect[3], prect[2] + pLineWidth)
  pSprites[#bottom].rect = rect(prect[1], prect[4] - pLineWidth, prect[3], prect[4])
  pSprites[#left].rect = rect(prect[1], prect[2], prect[1] + pLineWidth, prect[4])
  pSprites[#right].rect = rect(prect[3] - pLineWidth, prect[2], prect[3], prect[4])
end

on finish me
  me.freeSprites()
end

on freeSprites me
  g.spriteMaster.freeSprites(pSprites)
end

on offscreen me
  me.setRect(pOffscreenRect)
end

on requestSprites me
  repeat with i = 1 to pSprites.count
    pSprites[i] = g.spriteMaster.requestSprite()
    pSprites[i].color = pcolor
    pSprites[i].locZ = player
  end repeat
end

on setRect me, therect
  prect = therect.duplicate()
  me.display()
end
