global g, q, r, gGameSpeed, gFrameNum, gStageSize, gMapLayer, gGameObjectLayer, gPlayerLayer, gMenuLayer, gMenuTextLayer, gGridSelectorLayer

on startMovie
  g = [:]
  q = QUOTE
  r = RETURN
  put r & "-- < start new movie > " & r
  go(1)
  gFrameNum = 0
  gGameSpeed = 1
  gMapLayer = 1
  gGameObjectLayer = 50
  gPlayerLayer = 99
  gMenuLayer = 150
  gMenuTextLayer = 151
  gGridSelectorLayer = 200
  gStageSize = point((the stage).rect.width, (the stage).rect.height)
  createObjects()
  createMainObjects()
  initMainObjects()
  g.movieMaster.start()
end

on nextframe
  gFrameNum = gFrameNum + 1
  g.updater.updatePrgs()
  updateStage()
end

on stopMovie
  stopMainObjects()
  put r & "-- < end of movie > " & r
end

on createObjects
  g[#objectMaster] = new(script("objectMaster"))
  g.objectMaster.init()
  g[#updater] = g.objectMaster.requestObject(#objUpdater)
  g.updater.init([#hi, #med, #lo])
end

on createMainObjects
  objects = CastGetListNames("master_objects")
  repeat with obj in objects
    comm = "g[#" & obj & "] = new (script " & q & obj & q & ")"
    do(comm)
    comm = "put g." & obj & "&&" & q & "created" & q
    do(comm)
  end repeat
end

on initMainObjects
  objects = CastGetListNames("master_objects")
  repeat with obj in objects
    comm = "g." & obj & ".init()"
    do(comm)
  end repeat
end

on stopMainObjects
  objects = CastGetListNames("master_objects")
  repeat with obj in objects
    comm = "g." & obj & ".stop()"
    do(comm)
  end repeat
end
