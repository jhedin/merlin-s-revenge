property pPlayer
global g, q, gGameObjectLayer, gPlayerLayer

on new me
  return me
end

on init me
end

on finishActors me
  g.objectMaster.finishAllWithFlag(#objGameObject)
end

on newActor me, typ, startLoc
  freeSprite = g.spriteMaster.checkFreeSprite()
  obj = #none
  if freeSprite then
    player = g.objectMaster.getFirstOfType(#objPlayerCharacter)
    obj = me.startActor(typ, startLoc, player)
  end if
  return obj
end

on start me
  g.EnemyEnergyMaster.start()
  player = me.startActor(#player, point(100, 250))
  pPlayer = player
  startActors = []
  startActors.append([#objType: #bat, #quantity: 0])
  startActors.append([#objType: #bigWitch, #quantity: 0])
  startActors.append([#objType: #goblin, #quantity: 1])
  startActors.append([#objType: #goblinSoldier, #quantity: 1])
  startActors.append([#objType: #hairSpider, #quantity: 0])
  startActors.append([#objType: #spider, #quantity: 0])
  startActors.append([#objType: #littleWitch, #quantity: 0])
  startActors.append([#objType: #fryingPan, #quantity: 1])
  startActors.append([#objType: #hairDrop, #quantity: 0])
  startActors.append([#objType: #paddle, #quantity: 0])
  startActors.append([#objType: #pugelstick, #quantity: 0])
  startActors.append([#objType: #spade, #quantity: 0])
  startActors.append([#objType: #sword, #quantity: 0])
  startActors.append([#objType: #scissors, #quantity: 1])
  repeat with startActor in startActors
    repeat with i = 1 to startActor.quantity
      me.startActor(startActor.objType, point(random(450), 300))
    end repeat
  end repeat
end

on startActor me, typ, startLoc
  AI = #none
  AIType = #none
  AiTarget = #none
  AiTargetAction = #none
  objType = #none
  case typ of
    #star:
      objType = #objStar
    #bat:
      objType = #objFlyingEnemyCharacter
      AIType = #objAiEnemy
    #bigWitch:
      objType = #objFlyingEnemyCharacter
      AIType = #objAiFlyingBomber
    #goblin:
      objType = #objEnemyCharacter
      AIType = #objAiEnemy
    #goblinSoldier:
      objType = #objEnemyCharacter
      AIType = #objAIEnemyWeaponSeek
    #hairSpider:
      objType = #objAttachingEnemyCharacter
      AIType = #objAiEnemyTargetSeek
      AiTarget = #playerHair
      AiTargetAction = #attach
    #spider:
      objType = #objEnemyCharacter
      AIType = #objAiEnemy
    #littleWitch:
      objType = #objEnemyCharacter
      AIType = #objAiEnemy
    #bigFireball:
      objType = #objBullet
    #fireBall:
      objType = #objBullet
    #hair:
      objType = #objHair
    #player:
      objType = #objPlayerCharacter
      AIType = #objAiPlayer
    #hairDrop, #hairPowerUp:
      objType = #objPowerUp
      AIType = #objAiPowerUp
    #fryingPan, #paddle, #pugelstick, #spade, #scissors, #sword:
      objType = #objWeapon
  end case
  if objType = #none then
    alert("actorMaster.newActor: please define typ " & q & typ & q)
    nothing()
  end if
  obj = g.objectMaster.requestObject(objType)
  if AIType <> #none then
    AI = g.objectMaster.requestObject(AIType)
    AI.init(pPlayer)
    if AIType = #objAiEnemyTargetSeek then
      AI.setTargetType(AiTarget)
      AI.setAction(AiTargetAction)
    end if
  end if
  params = me.setParams(obj, typ, AI)
  params.initLoc = startLoc.duplicate()
  obj.init(params)
  obj.start()
  return obj
end

on setParams me, obj, typ, AI
  params = obj.getParams(#init)
  if AI <> #none then
    params.AI = AI
  end if
  params.initLoc = point(random(450), 300)
  params.initVect = point(0, 0)
  params.layerZ = gGameObjectLayer
  params.masterPrg = me
  case typ of
    #bigFireball:
      a = params.attack
      a.power = point(7, 2)
      params.character = #bullet
      params.name = "bfb"
      params.initVect = point(0, 0)
      params.friction = point(5, 0)
      params.weight = 0.29999999999999999
    #fireBall:
      a = params.attack
      a.power = point(5, 1)
      params.character = #bullet
      params.name = "fir"
      params.initVect = point(0, 0)
      params.friction = point(5, 0)
      params.weight = 0.40000000000000002
    #star:
      params.character = #star
      params.member = member("star_medium", "gfx")
      params.weight = 0.29999999999999999
    #hair:
      params.character = #hair
      params.collisionUseMiddle = 1
      params.friction = point(12.5, 12.5)
      params.hairLength = 14
      params.keepVect = 1
      params.layerZ = gPlayerLayer
      params.startLocOffset = point(10, 0)
      params.weight = 0.34999999999999998
    #player:
      params.character = #playerCharacter
      params.energy = 200
      params.hairLength = 10
      params.layerZ = gPlayerLayer
      params.name = "rap"
    #hairDrop:
      params.character = #hairDrop
      params.member = member("hair_drop", "gfx")
    #hairPowerUp:
      params.character = #hairPowerUp
      params.member = member("raphair", "gfx")
      params.timeAlive = random(150) + 30
    #pugelstick, #fryingPan, #spade, #paddle, #scissors, #sword:
      params = me.setParamsWeapon(typ, params)
    otherwise:
      params = me.setParamsEnemy(typ, params)
  end case
  return params
end

on setParamsEnemy me, typ, params
  a = params.attack
  a.collisionLoc = point(15, 0)
  a.reach = point(15, 0)
  params.name = "gob"
  params.jumpPower = -5
  params.walkAcceleration = 0.20000000000000001
  case typ of
    #bat:
      params.character = #flyingEnemyCharacter
      params.name = "bat"
      params.jumpPower = -5
      params.jumpType = #jump
      params.friction = point(12.5, 12.5)
    #bigWitch:
      a.bullet = #bigFireball
      a.type = #ranged
      a.collisionLoc = point(20, 0)
      a.idealAttackLoc = point(0, -200)
      a.cooldown = 50
      a.reach = point(200, 300)
      params.character = #flyingRecoilEnemyCharacter
      params.name = "wit"
      params.energyBarColour = rgb(0, 0, 0)
      params.jumpPower = -1
      params.jumpType = #lift
      params.friction = point(2, 2)
      params.flapFrame = 1
      params.weight = 0.40000000000000002
      params.recoil = 1
      params.recoilDuration = 20
    #goblin:
      nothing()
    #goblinSoldier:
      a.collisionLoc = point(20, 0)
      a.reach = point(20, 0)
      params.name = "gobsol"
      params.energy = 150
      params.energyBarColour = rgb(255, 200, 0)
      params.jumpPower = -8
      params.rotationSpeed = 15
      params.walkAcceleration = 0.25
      params.weight = 0.5
    #littleWitch:
      a.animframe = 4
      a.bullet = #fireBall
      a.reach = point(150, 150)
      a.type = #ranged
      params.name = "lwi"
      params.energy = 100
      params.energyBarColour = rgb(30, 30, 30)
      params.jumpPower = -4
      params.weight = 0.075
      params.rotationSpeed = 10
      params.walkAcceleration = 0.14999999999999999
    #hairSpider:
      a.collisionLoc = point(10, 0)
      a.reach = point(10, 0)
      a.animframe = 4
      a.power = point(2, -2)
      params.attachDuration = 60
      params.energyBarColour = rgb(200, 200, 0)
      params.name = "hsp"
      params.rotationSpeed = 10
      params.weight = 0.10000000000000001
      params.walkAcceleration = 0.20000000000000001
    #spider:
      a.collisionLoc = point(10, 0)
      a.reach = point(10, 0)
      a.animframe = 4
      a.power = point(2, -2)
      params.energyBarColour = rgb(92, 148, 133)
      params.name = "spi"
      params.rotationSpeed = 10
      params.weight = 0.10000000000000001
      params.walkAcceleration = 0.20000000000000001
  end case
  return params
end

on setParamsWeapon me, weaponType, params
  params.character = #weapon
  params.minCollisionSpeed = 4
  a = params.attack
  case weaponType of
    #pugelstick:
      params.name = "pug"
      a.collisionLoc = point(40, 0)
      a.reach = point(42, 0)
      a.power = point(4, -1.5)
    #fryingPan:
      params.name = "pan"
      a.collisionLoc = point(25, 0)
      a.reach = point(27, 0)
      a.power = point(3, -0.5)
    #paddle:
      params.name = "pad"
      a.collisionLoc = point(70, 0)
      a.reach = point(72, 0)
      a.power = point(5, -1)
    #scissors:
      params.name = "sci"
      a.collisionLoc = point(58, -7)
      a.cutHair = 1
      a.reach = point(70, 10)
      a.power = point(2, -2)
    #spade:
      params.name = "spd"
      a.collisionLoc = point(35, 0)
      a.reach = point(37, 0)
      a.power = point(4.5, -2)
    #sword:
      params.name = "swd"
      a.collisionLoc = point(60, 10)
      a.cutHair = 1
      a.reach = point(80, 10)
      a.power = point(8, -2)
  end case
  return params
end

on getPlayer me
  return pPlayer
end

on stop me
end
