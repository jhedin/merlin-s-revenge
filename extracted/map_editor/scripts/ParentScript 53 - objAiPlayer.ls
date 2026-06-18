property ancestor
global g

on new me
  ancestor = new(script("objAi"))
  return me
end

on init me
end

on initCharacterInfo me, characterPrg, spr
  ancestor.initCharacterInfo(characterPrg, spr)
  me.goMode(#playerControl)
end

on characterModeChanged me, newCharMode
  case newCharMode of
    #die:
      me.goMode(#dazed)
  end case
end

on finish me
  ancestor.finish()
end

on update me
  if me.pmode = #playerControl then
    moveVector = g.keyMaster.getMoveVector()
    me.pCharacterPrg.moveHoriz(moveVector[1])
    case moveVector[2] of
      (-1):
        me.pCharacterPrg.doJump()
      0, 1:
        me.pCharacterPrg.noJump()
    end case
    growPressed = g.keyMaster.getKeyResult(#growHair)
    if growPressed then
      g.actorMaster.newActor(#hairDrop, point(random(480), random(300)))
    end if
    cutPressed = g.keyMaster.getKeyResult(#cutHair)
    if cutPressed then
      me.pCharacterPrg.trimHair()
    end if
    if g.keyMaster.getKeyResult(#newBat) then
      g.actorMaster.newActor(#bat, point(100, 100))
    end if
    goblinPressed = g.keyMaster.getKeyResult(#newGoblin)
    if goblinPressed then
      g.actorMaster.newActor(#littleWitch, point(random(480), random(300)))
    end if
    if g.keyMaster.getKeyResult(#newGoblinSoldier) then
      g.actorMaster.newActor(#bigWitch, point(random(480), random(300)))
    end if
    if g.keyMaster.getKeyResult(#newSpider) then
      g.actorMaster.newActor(#hairSpider, point(random(480), random(300)))
    end if
  end if
end
