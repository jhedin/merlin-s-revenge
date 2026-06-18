property p, p3DWorld, pShader
global g, g3DMode

on new me
  return me
end

on init me
  p = [:]
  p[#spriteList] = []
  p[#spriteInfo] = []
  me.initSpriteLists()
end

on init3DWorld me
  p3DWorld = member("3DWorld", "gfx")
  sprite(1).member = p3DWorld
  sprite(1).rect = rect(0, 0, (the stage).rect.width, (the stage).rect.height)
  if voidp(p3DWorld.shader("aShader")) then
    pShader = p3DWorld.newShader("aShader", #standard)
    pShader.blendFunction = #replace
  end if
end

on initSpriteLists me
  lastChan = the lastChannel
  repeat with i = 1 to lastChan
    if g3DMode = 0 then
      spr = sprite(i)
    else
      spr = g.objectMaster.requestObject(#obj3DSprite)
      params = spr.getParams(#init)
      params.spriteNum = i
      spr.init(params)
    end if
    if spr.member = member("dot", "gfx") then
      p.spriteList[i] = spr
      p.spriteInfo[i] = [#inuse: 0, #lastUser: #none]
      me.freeSprite(i)
    end if
  end repeat
end

on checkFreeSprite me
  repeat with sprInfo in p.spriteInfo
    if sprInfo.inuse = 0 then
      return 1
    end if
  end repeat
end

on freeSprite me, sprNum
  if ilk(sprNum) <> #integer then
    sprNum = sprNum.spriteNum
  end if
  spr = p.spriteList[sprNum]
  spr.flipH = 0
  spr.locH = -1
  spr.locV = -1
  spr.locZ = spr.spriteNum
  spr.member = member("dot", "gfx")
  spr.blend = 100
  spr.visible = 1
  spr.color = rgb(0, 0, 0)
  spr.bgColor = rgb(255, 255, 255)
  spr.width = 1
  spr.height = 1
  spr.ink = 36
  spr.rotation = 0
  p.spriteInfo[sprNum].inuse = 0
end

on freeSprites me, sprList
  repeat with spr in sprList
    me.freeSprite(spr)
  end repeat
end

on findFreeSprite me
  repeat with i = 1 to p.spriteInfo.count
    spr = p.spriteInfo[i]
    if spr.inuse = 0 then
      return p.spriteList[i]
    end if
  end repeat
end

on get3DWorld me
  return p3DWorld
end

on getShader me
  return pShader
end

on getSpritesInUse me
  numInUse = 0
  repeat with spr in p.spriteInfo
    if spr.inuse = 1 then
      numInUse = numInUse + 1
    end if
  end repeat
  return numInUse
end

on getSpriteWithMember me, member
  repeat with spr in p.spriteList
    if spr.member = member then
      return spr
    end if
  end repeat
  return #none
end

on hideAll2DSprites me
  me.setAll2DProperty(#visible, 0)
end

on setAll2DProperty me, theProperty, theValue
  repeat with i = 1 to the lastChannel
    spr = sprite(i)
    case theProperty of
      #visible:
        spr.visible = theValue
    end case
  end repeat
end

on showAll2DSprites me
  me.setAll2DProperty(#visible, 1)
end

on visibleAll me, bVisible
  repeat with spr in p.spriteList
    spr.visible = bVisible
  end repeat
end

on requestSprite me, requester
  spr = me.findFreeSprite()
  p.spriteInfo[spr.spriteNum].inuse = 1
  p.spriteInfo[spr.spriteNum].lastUser = requester
  return spr
end

on stop me
end

on updateSprites me
  repeat with spr in p.spriteList
    spr.update()
  end repeat
end
