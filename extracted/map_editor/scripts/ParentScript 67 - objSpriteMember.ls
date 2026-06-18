property ancestor, pSprite, pMember, pMemberType
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#memberType] = #bitmap
  return me
end

on init me, params
  pSprite = #none
  pMember = #none
  pMemberType = params.memberType
end

on finish me
  me.offscreen()
end

on displayImageAtLoc me, theImage, theloc
  me.requestSprite()
  me.requestMember()
  me.setImage(theImage)
  me.setMember()
  me.setRegpoint(#topLeft)
  me.setSpriteLoc(theloc)
end

on freeSprite me
  if pSprite <> #none then
    g.spriteMaster.freeSprite(pSprite)
    pSprite = #none
  end if
end

on freeMember me
  if pMember <> #none then
    g.memberMaster.freeMember(pMember)
    pMember = #none
  end if
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
  end if
end

on requestSprite me
  if pSprite = #none then
    pSprite = g.spriteMaster.requestSprite()
  end if
end

on setSpriteLayer me, theLayer
  pSprite.locZ = theLayer
end

on setImage me, theImage
  me.requestMember()
  pMember.image = theImage
end

on setRegpoint me, where
  if ilk(where, #symbol) then
    case where of
      #topLeft:
        where = point(0, 0)
    end case
  end if
  pMember.regPoint = where.duplicate()
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

on setSpriteLoc me, where
  pSprite.loc = where.duplicate()
end
