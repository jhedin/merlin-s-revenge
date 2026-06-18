property ancestor, pAI

on new me
  ancestor = new(script("objGameObject"))
  i = me.pParams.init
  i[#AI] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pAI = params.AI
  pAI.initCharacterInfo(me.id.bigMe, me.pSpr, params)
end

on finish me
  pAI.finish()
  ancestor.finish()
end

on updateAI me
  pAI.update()
end
