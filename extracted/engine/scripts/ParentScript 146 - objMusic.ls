property ancestor, pMusicName
global g

on new me
  ancestor = new(script("objGameObject"))
  i = me.modifyParams(#init)
  i[#musicName] = #none
  me.addModule("modAnimSet")
  return me
end

on init me, params
  ancestor.init(params)
  pMusicName = params.musicName
end

on start me
  ancestor.start()
  g.soundmaster.playMusic(pMusicName)
end
