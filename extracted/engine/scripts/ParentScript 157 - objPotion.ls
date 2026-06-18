property ancestor, pCounterColour

on new me
  ancestor = new(script("objPowerUpWriting"))
  i = me.modifyParams(#init)
  i[#counterColour] = rgb(255, 255, 255)
  return me
end

on init me, params
  ancestor.init(params)
  pCounterColour = params.counterColour
end

on checkDead me
  return 0
end

on collected me, collector
  ancestor.collected(collector)
  collector.potionCollected(me.getCharacter(), me.id.bigMe)
end

on getCounterColour me
  return pCounterColour
end

on getCounterMember me
  return me.getNonWritingMember()
end
