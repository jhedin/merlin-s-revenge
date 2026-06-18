property ancestor, blend, bgColor, color, flipH, flipV, loc, locH, locV, locZ, height, ink, member, rect, rotation, spriteNum, visible, width, pmodel, pModelName
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#spriteNum] = 0
  return me
end

on init me, params
  spriteNum = params.spriteNum
  member = member("dot", "gfx")
  rect = rect(-1, -1, 0, 0)
end

on init3DPresence me
  w = g.spriteMaster.get3DWorld()
  pModelName = "sprite_" & spriteNum
  mr = w.newModelResource(pModelName, #plane, #front)
  mr.length = member.height
  mr.width = member.width
  mr.lengthVertices = 2
  mr.widthVertices = 2
  m = w.newModel(pModelName, mr)
  m.rotate(-180, 0, 180)
  pmodel = m
end

on update me
end
