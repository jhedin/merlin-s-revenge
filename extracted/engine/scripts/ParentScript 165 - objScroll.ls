property ancestor, pAttack

on new me
  ancestor = new(script("objPowerUpWriting"))
  i = me.modifyParams(#init)
  i[#attack] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pAttack = params.attack
end

on finish me
  ancestor.finish()
end

on checkDead me
  return 0
end

on collected me, collector
  ancestor.collected(collector)
  if pAttack <> #none then
    collector.newScrollCollected(me.big.getCharacter(), pAttack.duplicate())
  else
    collector.newScrollCollected(me.big.getCharacter(), #none)
  end if
end
