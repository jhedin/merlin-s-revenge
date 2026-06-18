property ancestor, pSpr, pMem
global g, gMenuTextLayer

on new me
  ancestor = new(script("objButton"))
  i = me.modifyParams(#init)
  i[#layer] = gMenuTextLayer
  i[#location] = point(10, 10)
  i[#name] = "textButton"
  i[#myText] = "button"
  i[#textParams] = g.memberMaster.getParams(#requestTextMember)
  i.pulse = 0
  return me
end

on init me, params
  pSpr = g.spriteMaster.requestSprite()
  pMem = g.memberMaster.requestTextMember(params.textParams, params.name)
  pMem.text = params.myText
  SpriteSetMember(pSpr, pMem)
  pSpr.loc = params.location
  pSpr.locZ = params.layer
  params.spr = pSpr
  ancestor.init(params)
end

on finish me
  g.spriteMaster.freeSprite(pSpr)
  g.memberMaster.freeMember(pMem)
  ancestor.finish()
end
