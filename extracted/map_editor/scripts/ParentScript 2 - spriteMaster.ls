property p

on new me
  return me
end

on init me
  p = [:]
  p[#spriteList] = []
  p[#spriteInfo] = []
  me.initSpriteList()
end

on initSpriteList me
  lastChan = the lastChannel
  repeat with i = 1 to lastChan
    if sprite(i).member = member("dot", "gfx") then
      p.spriteList[i] = sprite(i)
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
  spr = p.spriteList[sprNum]
  spr.flipH = 0
  spr.locH = -1
  spr.locV = -1
  spr.locZ = spr.spriteNum
  spr.member = member("dot", "gfx")
  spr.blend = 100
  spr.visible = 1
  spr.color = rgb(0, 0, 0)
  spr.width = 1
  spr.height = 1
  spr.ink = 36
  spr.rotation = 0
  p.spriteInfo[sprNum] = [#inuse: 0]
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

on visibleAll me, bVisible
  repeat with spr in p.spriteList
    spr.visible = bVisible
  end repeat
end

on requestSprite me
  sprNum = me.findFreeSprite()
  p.spriteInfo[sprNum].inuse = 1
  return sprNum
end

on stop me
end
