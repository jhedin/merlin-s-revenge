property ancestor, pMusicToPlay
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#definition] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pMusicToPlay = params.definition
end

on finish me
  ancestor.finish()
end

on playMusic me
  g.soundmaster.playMusic(pMusicToPlay)
end
