property ancestor, player, pSprite, pSpriteRequestedByMe, pMember, pMemberRequestedByMe, pMemberType
global g

on new me
  ancestor = new(script("objModules"))
  i = me.modifyParams(#init)
  i[#layer] = 1
  i[#member] = #none
  i[#memberType] = #bitmap
  i[#spr] = #none
  return me
end

on init me, params
  ancestor.init(params)
  player = params.layer
  pMember = params.member
  pMemberRequestedByMe = 1
  pMemberType = params.memberType
  pSprite = params.spr
  pSpriteRequestedByMe = 1
  if pSprite <> #none then
    if pMember = #none then
      pMember = pSprite.member
    end if
    me.setSprite(pSprite)
    pSpriteRequestedByMe = 0
  end if
  if pMember <> #none then
    pMemberRequestedByMe = 0
  end if
end

on finish me
  me.offscreen()
  ancestor.finish()
end

on centerAlign me, x1, x2
  columnWidth = x2 - x1
  spaces = columnWidth - me.getSpriteWidth()
  leftSpace = spaces / 2
  ourLeft = x1 + leftSpace
  locx = ourLeft
  me.setSpriteLocH(locx)
end

on displayImageAtLoc me, theImage, theloc
  me.requestSprite()
  me.requestMember()
  me.setImage(theImage)
  me.setMember()
  me.setRegpoint(#topLeft)
  me.setSpriteLoc(theloc)
end

on ensureSpriteAndMember me
  if (pSprite = #none) and (pMember = #none) then
    me.requestSprite()
    me.requestMember()
    me.setImage(member("dot", "gfx").image)
    me.setMember()
  end if
end

on freeSpriteAndMember me
  me.offscreen()
end

on freeSprite me
  if (pSprite <> #none) and pSpriteRequestedByMe then
    g.spriteMaster.freeSprite(pSprite)
    pSprite = #none
  end if
end

on freeMember me
  if (pMember <> #none) and pMemberRequestedByMe then
    g.memberMaster.freeMember(pMember)
    pMember = #none
  end if
end

on getImage me
  return pSprite.member.image
end

on getMember me
  return pSprite.member
end

on getMemberWidth me
  return pMember.width
end

on getMemberType me
  return pSprite.member.type
end

on getRegPoint me
  return pSprite.member.regPoint
end

on getSprite me
  return pSprite
end

on getSpriteColor me
  return pSprite.color
end

on getSpriteLoc me
  return pSprite.loc
end

on getSpriteRect me
  sprloc = me.getSpriteLoc()
  sprWidth = me.getSpriteWidth()
  sprHeight = me.getSpriteHeight()
  myRect = rect(sprloc[1], sprloc[2], sprloc[1] + sprWidth, sprloc[2] + sprHeight)
  return myRect
end

on getSpriteHeight me
  return pSprite.height
end

on getSpriteWidth me
  return pSprite.width
end

on offscreen me
  me.freeSprite()
  me.freeMember()
end

on requestMember me
  if pMember = #none then
    pMember = g.memberMaster.requestMember(pMemberType)
    pMemberRequestedByMe = 1
  end if
end

on requestSprite me
  if pSprite = #none then
    spr = g.spriteMaster.requestSprite(me.id.bigMe)
    me.setSprite(spr)
  end if
end

on setImage me, theImage
  me.requestMember()
  pMember.image = theImage
  me.setMember()
end

on setMember me
  me.requestSprite()
  if pMemberType <> #bitmap then
    memType = pMemberType
    pMember.editable = 1
  end if
  SpriteSetMember(pSprite, pMember, memType)
end

on setMemberName me, thename
  pMember.name = thename
end

on setRegpoint me, where
  if ilk(where, #symbol) then
    case where of
      #topLeft:
        where = point(0, 0)
      #topRight:
        where = point(me.getMemberWidth(), 0)
    end case
  end if
  pMember.regPoint = where.duplicate()
end

on setSprite me, spr
  pSprite = spr
  me.setSpriteLayer(player)
end

on setSpriteBlend me, theAmount
  pSprite.blend = theAmount
end

on setSpriteColour me, theColour
  me.setSpriteColor(theColour)
end

on setSpriteColor me, theColor
  pSprite.color = theColor
end

on setSpriteFlipFromDir me, thedir
  if thedir = 1 then
    pSprite.flipH = 0
    me.setRegpoint(#topLeft)
  else
    if thedir = -1 then
      pSprite.flipH = 1
      me.setRegpoint(#topRight)
    end if
  end if
end

on setSpriteHeight me, newVal
  pSprite.height = newVal
end

on setSpriteLocZ me, theLocZ
  me.setSpriteLayer(theLocZ)
end

on setSpriteLayer me, theLayer
  pSprite.locZ = theLayer
end

on setSpriteLoc me, where
  if pSprite <> #none then
    pSprite.loc = where.duplicate()
  end if
end

on setSpriteLocH me, where
  if pSprite <> #none then
    pSprite.locH = where
  end if
end

on setSpriteRect me, therect
  pSprite.rect = therect.duplicate()
end

on setSpriteWidth me, newVal
  pSprite.width = newVal
end
