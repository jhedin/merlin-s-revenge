property ancestor, pSoundChannel, pSoundToPlay
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#definition] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pSoundToPlay = params.definition
end

on finish me
  ancestor.finish()
end

on PlaySound me
  pSoundChannel = g.soundmaster.PlaySound(pSoundToPlay)
end
