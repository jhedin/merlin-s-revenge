property ancestor, pcolor, player, pLineWidth, pMember, pmode, pOffscreenRect, prect, pSprites
global g, gGridSelectorLayer

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#color] = rgb(255, 255, 0)
  i[#initialRect] = #none
  i[#layer] = gGridSelectorLayer
  i[#linewidth] = 1
  i[#member] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pOffscreenRect = rect(-1, -1, 0, 0)
  pcolor = params.color
  player = gGridSelectorLayer
  pLineWidth = params.linewidth
  pMember = params.member
  pSprites = #none
  if pMember = #none then
    pmode = #drawLines
  else
    pmode = #drawBitmap
  end if
  me.requestSprites()
  if params.initialRect <> #none then
    me.setRect(params.initialRect)
  end if
end

on display me
  case pmode of
    #drawLines:
      pSprites[#top].rect = rect(prect[1], prect[2], prect[3], prect[2] + pLineWidth)
      pSprites[#bottom].rect = rect(prect[1], prect[4] - pLineWidth, prect[3], prect[4])
      pSprites[#left].rect = rect(prect[1], prect[2], prect[1] + pLineWidth, prect[4])
      pSprites[#right].rect = rect(prect[3] - pLineWidth, prect[2], prect[3], prect[4])
    #drawBitmap:
      pSprites[1].rect = prect.duplicate()
  end case
end

on finish me
  me.freeSprites()
  ancestor.finish()
end

on freeSprites me
  g.spriteMaster.freeSprites(pSprites)
end

on offscreen me
  me.setRect(pOffscreenRect)
end

on requestSprites me
  case pmode of
    #drawLines:
      pSprites = g.structMaster.getStruct(#boxSprites)
      repeat with i = 1 to pSprites.count
        pSprites[i] = g.spriteMaster.requestSprite()
        pSprites[i].color = pcolor
        pSprites[i].locZ = player
      end repeat
    #drawBitmap:
      pSprites = []
      pSprites.append(g.spriteMaster.requestSprite())
      SpriteSetMember(pSprites[1], pMember)
      pSprites[1].locZ = player
  end case
end

on setColor me, theColor
  pcolor = theColor
  repeat with i = 1 to pSprites.count
    pSprites[i].color = pcolor
  end repeat
end

on setRect me, therect
  prect = therect.duplicate()
  me.display()
end
