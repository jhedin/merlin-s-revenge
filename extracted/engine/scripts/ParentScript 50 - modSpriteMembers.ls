property ancestor, pSpriteMembers
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
  pSpriteMembers = []
end

on finish me
  ancestor.finish()
  me.finishSpriteMembers()
end

on finishSpriteMembers me
  if pSpriteMembers <> [] then
    repeat with sprMem in pSpriteMembers
      sprMem.finish()
    end repeat
  end if
  pSpriteMembers = []
end

on newSpriteMember me
  newSprMem = g.objectMaster.requestObject(#objSpriteMember)
  params = newSprMem.getParams(#init)
  params.layer = me.big.getLayer()
  newSprMem.init(params)
  pSpriteMembers.append(newSprMem)
  return newSprMem
end
