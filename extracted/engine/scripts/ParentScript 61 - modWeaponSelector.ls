property ancestor, pDisplaying, pGreenBoxMember, pPaletteDefinitionMembers, pPaletteDefinitionStart, pPaletteImageMembers, pPaletteObjects, pPaletteOffsets, pPaletteTypes, pTimer, pWeapons, pYellowBoxMember
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  pDisplaying = 0
  pGreenBoxMember = member("greenBox_ws", "gfx")
  pPaletteDefinitionMembers = [:]
  pPaletteDefinitionStart = "tileSize | point(18,16)" & RETURN
  pPaletteImageMembers = [:]
  pPaletteObjects = [:]
  pPaletteOffsets = g.structMaster.getStruct(#weaponSelectorPaletteOffsets)
  pPaletteTypes = g.structMaster.getStruct(#weaponSelectorPaletteTypes)
  pTimer = CounterNew()
  pTimer.tim[2] = 60
  pYellowBoxMember = member("yellowBox_ws", "gfx")
  pWeapons = [:]
  ancestor.init(params)
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on finish me
  me.finishMembers()
  ancestor.finish()
end

on finishMembers me
  if pPaletteDefinitionMembers <> [:] then
    repeat with nMember in pPaletteDefinitionMembers
      g.memberMaster.freeMember(nMember)
    end repeat
    pPaletteDefinitionMembers = [:]
  end if
  if pPaletteImageMembers <> [:] then
    repeat with nMember in pPaletteImageMembers
      g.memberMaster.freeMember(nMember)
    end repeat
    pPaletteImageMembers = [:]
  end if
  if pPaletteObjects <> [:] then
    call(#finish, pPaletteObjects)
    pPaletteObjects = [:]
  end if
end

on commandIssued me, theWeapon
  me.id.bigMe.setCurrentWeapon(theWeapon)
  me.offscreen()
end

on constructImage me, weapons
  if weapons.count = 0 then
    return #none
  end if
  firstIcon = me.getWeaponIcon(weapons[1])
  iconHeight = firstIcon.height
  iconWidth = firstIcon.width
  imageHeight = iconHeight
  imageWidth = iconWidth * weapons.count
  newImage = image(imageWidth, imageHeight, 32)
  repeat with i = 1 to weapons.count
    nWeapon = weapons[i]
    nIcon = me.getWeaponIcon(nWeapon)
    srcRect = nIcon.rect
    x1 = (i - 1) * iconWidth
    x2 = i * iconWidth
    destRect = rect(x1, 0, x2, imageHeight)
    newImage.copyPixels(nIcon, destRect, srcRect, [#useFastQuads: 1])
  end repeat
  return newImage
end

on displayWeaponSelector me
  if pDisplaying = 1 then
    return 
  end if
  repeat with nType in pPaletteTypes
    weapons = me.id.bigMe.getWeapons(nType)
    pWeapons[nType] = weapons.duplicate()
    paletteDefinition = me.writePaletteDefinition(weapons)
    paletteImage = me.constructImage(weapons)
    if paletteImage <> #none then
      memberName = string(nType) & "Palette_key"
      pPaletteDefinitionMembers[nType] = g.memberMaster.requestMember(#field, memberName)
      pPaletteDefinitionMembers[nType].text = paletteDefinition
      memberName = string(nType) & "Palette"
      pPaletteImageMembers[nType] = g.memberMaster.requestMember(#bitmap, memberName)
      pPaletteImageMembers[nType].image = paletteImage
      nObject = g.objectMaster.requestObject(#objPalette)
      params = nObject.getParams(#init)
      params.allTilesImage = paletteImage
      params.displayScale = 1
      params.greenBoxMember = pGreenBoxMember
      params.member = pPaletteImageMembers[nType]
      params.sym = nType
      params.location = g.mouseMaster.getMouseLoc() + me.getPaletteOffset(nType)
      params.targetObject = me.id.bigMe
      params.yellowBoxMember = pYellowBoxMember
      nObject.init(params)
      nObject.display()
      pPaletteObjects[nType] = nObject
    end if
  end repeat
  CounterReset(pTimer)
  pDisplaying = 1
end

on getInitialGridSelection me, paletteType
  currentWeapon = me.id.bigMe.getCurrentWeapon()
  weaponPos = pWeapons[paletteType].getPos(currentWeapon)
  if weaponPos = 0 then
    return #none
  else
    gridLoc = point(weaponPos, 1)
    return gridLoc
  end if
end

on getPaletteOffset me, theType
  imageWidth = pPaletteImageMembers[theType].width
  yOffset = pPaletteOffsets[theType]
  xOffset = imageWidth / 2 * -1
  return point(xOffset, yOffset)
end

on getWeaponIcon me, weaponSym
  memname = string(weaponSym) & "_ws"
  return member(memname, "gfx").image
end

on offscreen me
  me.finishMembers()
  pDisplaying = 0
end

on update me
  ancestor.update()
  if pDisplaying then
    me.updateTimer()
  end if
end

on updateLocation me
  repeat with i = 1 to pPaletteImageMembers.count
    nType = pPaletteImageMembers.getPropAt(i)
    nObject = pPaletteObjects[nType]
    nObject.updateLocation(me.id.bigMe.getLoc() + me.getPaletteOffset(nType))
  end repeat
end

on updateTimer me
  counter(pTimer)
  if pTimer.fin then
    me.offscreen()
  end if
end

on writePaletteDefinition me, weaponsList
  if weaponsList.count = 0 then
    return #none
  end if
  newDefinition = pPaletteDefinitionStart
  repeat with nWeapon in weaponsList
    newDefinition = newDefinition & "#" & nWeapon & RETURN
  end repeat
  return newDefinition
end
