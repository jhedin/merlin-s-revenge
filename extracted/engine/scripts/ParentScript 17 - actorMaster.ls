property pObjectOffsets, pParams, pPlayer
global g, q, gGameObjectLayer, gPlayerLayer, gMineLayer, gEnemyEnergyMasterOn

on new me
  return me
end

on init me
  pPlayer = #none
  pParams = [:]
  pParams[#newActor] = [:]
  n = pParams.newActor
  n[#initVect] = #none
  n[#forceCreate] = 0
  n[#preBuilt] = 1
  n[#typ] = #none
  n[#startActor] = 1
  n[#startLoc] = #none
  n[#useOffset] = 1
  pObjectOffsets = [:]
  me.initObjectOffsets()
end

on initObjectOffsets
  memObjectOffsets = member("objectOffsets", "data")
  if memObjectOffsets = member(-1, 1) then
    put "actorMaster.initObjectOffsets(): objectOffsets member not found - not to worry, offsets are prolly defined in the actor data"
    return 
  end if
  theText = memObjectOffsets.text
  theText = StringEliminateChars(theText, RETURN)
  theVal = value(theText)
  if theVal <> VOID then
    pObjectOffsets = theVal
  else
    put "actorMaster.initObjectOffsets(): error in objectOffsets"
  end if
end

on finish me
  me.finishActors()
end

on finishActors me
  g.objectMaster.finishAllWithFlag(#objGameObject)
  pPlayer = #none
end

on newActor me, params
  if params.typ = #kongFuChicken then
    nothing()
  end if
  freeSprite = g.spriteMaster.checkFreeSprite()
  obj = #none
  if freeSprite then
    obj = me.startActor(params.typ, params.startLoc, params.useOffset, params.initVect, params.preBuilt, params.forceCreate, params.startActor)
  end if
  return obj
end

on adjustStartLoc me, theloc, typ
  oOffset = pObjectOffsets[typ]
  if oOffset <> VOID then
    theloc = theloc + oOffset
  end if
  return theloc
end

on checkCollisionsWithSolidArea me, theloc
  collisionsOk = 1
  currentMap = g.gamemaster.getCurrentMap()
  if currentMap <> #none then
    tileType = currentMap.getActiveTileTypeAtLoc(theloc)
    case tileType of
      #solid, #outsidePlayArea:
        collisionsOk = 0
    end case
  end if
  return collisionsOk
end

on getActorData me, actorSymbol
  return me.retrieveActorData(actorSymbol)
end

on getMiniMapStatusForSymbol me, theSymbol
  data = me.retrieveActorData(theSymbol)
  return data.miniMapStatus
end

on pauseGameObjects me
  gameObjects = g.objectMaster.getActiveObjectsWithFlag(#objGameObject)
  repeat with gameObject in gameObjects
    gameObject.paws()
  end repeat
end

on retrieveActorData me, datatyp
  dataObj = g.collectionsMaster.getObj(#objActorData, datatyp)
  data = dataObj.getData()
  if data[#inherit] <> VOID then
    inheritData = me.retrieveActorData(data.inherit)
    data = ListsMerge(inheritData.duplicate(), data)
  end if
  if (data[#attack] <> #none) and (data[#attack] <> VOID) then
    attack = g.structMaster.getStruct(#attack)
    data.attack = ListModifyProperties(attack, data.attack)
  end if
  return data
end

on start me
  if gEnemyEnergyMasterOn = 1 then
    g.EnemyEnergyMaster.start()
  end if
  return 
  player = me.startActor(#player, point(100, 250))
  pPlayer = player
  startActors = []
  startActors.append([#objType: #bat, #quantity: 0])
  startActors.append([#objType: #bigWitch, #quantity: 0])
  startActors.append([#objType: #goblin, #quantity: 0])
  startActors.append([#objType: #goblinSoldier, #quantity: 0])
  startActors.append([#objType: #hairSpider, #quantity: 0])
  startActors.append([#objType: #spider, #quantity: 0])
  startActors.append([#objType: #littleWitch, #quantity: 0])
  startActors.append([#objType: #fryingPan, #quantity: 0])
  startActors.append([#objType: #hairDrop, #quantity: 0])
  startActors.append([#objType: #paddle, #quantity: 0])
  startActors.append([#objType: #pugelstick, #quantity: 0])
  startActors.append([#objType: #spade, #quantity: 0])
  startActors.append([#objType: #sword, #quantity: 0])
  startActors.append([#objType: #scissors, #quantity: 0])
  repeat with startActor in startActors
    repeat with i = 1 to startActor.quantity
      me.startActor(startActor.objType, point(random(450), 300))
    end repeat
  end repeat
end

on startActor me, typ, startLoc, useOffsets, initVect, preBuilt, forceCreate, startActor
  actorData = me.retrieveActorData(typ)
  if actorData[#objType] = VOID then
    alert("actorMaster.newActor: please define typ " & q & typ & q)
    nothing()
  end if
  obj = g.objectMaster.requestObject(actorData[#objType])
  if actorData[#AIType] <> VOID then
    AI = g.objectMaster.requestObject(actorData[#AIType])
    params = AI.getParams(#init)
    AI.init(params)
    if actorData[#AIType] = #objAiEnemyTargetSeek then
      AI.setTargetType(actorData[#AiTarget])
      AI.setAction(actorData[#AiTargetAction])
    end if
  end if
  params = me.setParams(obj, actorData, AI)
  if useOffsets then
    startLoc = startLoc + params.startOffset
  end if
  params.initLoc = startLoc.duplicate()
  if initVect <> #none then
    params.initVect = initVect.duplicate()
  end if
  if params[#preBuilt] <> VOID then
    params.preBuilt = preBuilt
  end if
  if params.actorType = #typ then
    params.actorType = typ
  end if
  me.setParamsMaster(params)
  obj.init(params)
  if params.createOnSolid or forceCreate then
    collisionsOk = 1
  else
    collisionsOk = 1
    if obj.getCollisionDetection() = 1 then
      collisionsOk = g.collisionMaster.checkCollisionsNewObject(obj)
    end if
    if collisionsOk = 1 then
      if obj.getCollisionDetection() = 1 then
        collisionsOk = me.checkCollisionsWithSolidArea(startLoc)
      end if
    end if
  end if
  if collisionsOk then
    if startActor = 1 then
      obj.start()
    end if
  else
    obj.finish()
    obj = #none
  end if
  if typ = #player then
    pPlayer = obj
  end if
  return obj
end

on setParams me, obj, data, AI
  params = obj.getParams(#init)
  if AI <> VOID then
    params.AI = AI
  end if
  params = me.setParamsFromData(params, data)
  return params
end

on setParamsFromData me, params, data
  params = ListModifyProperties(params, data)
  return params
end

on setParamsMaster me, params
  case params.masterPrg of
    #actorMaster:
      params.masterPrg = me
  end case
end

on getParams me, functionSym
  return pParams[functionSym].duplicate()
end

on getPlayer me
  return pPlayer
end

on stop me
  me.finish()
end

on unpauseGameObjects me
  gameObjects = g.objectMaster.getActiveObjectsWithFlag(#objGameObject)
  repeat with gameObject in gameObjects
    gameObject.unpaws()
  end repeat
end
