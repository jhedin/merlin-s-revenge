property ancestor, pBox, pEndLoc, pMarkedForDeletion, prect, pStartLoc, pSym
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#rect] = rect(0, 0, 1, 1)
  i[#startLoc] = point(0, 0)
  i[#endLoc] = point(1, 1)
  i[#sym] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pBox = #none
  pMarkedForDeletion = 0
  pSym = params.sym
  pEndLoc = params.endLoc
  prect = params.rect
  pStartLoc = params.startLoc
  if params.rect <> rect(0, 0, 1, 1) then
    me.setRect(params.rect)
  else
    me.setStartLoc(params.startLoc)
    me.setEndLoc(params.endLoc)
  end if
end

on finish me
  if pBox <> #none then
    pBox.finish()
  end if
  ancestor.finish()
end

on attemptMerge me, mergeZone
  mySym = me.getSym()
  mergeSym = mergeZone.getSym()
  if mySym <> mergeSym then
    return 0
  end if
  myRect = me.getRect()
  mergeRect = mergeZone.getRect()
  potentialMerge = #none
  if (myRect[1] = mergeRect[1]) and (myRect[3] = mergeRect[3]) then
    potentialMerge = #vert
  end if
  if (myRect[2] = mergeRect[2]) and (myRect[4] = mergeRect[4]) then
    potentialMerge = #horiz
  end if
  if (potentialMerge = #vert) and (mySym = #platform) then
    return 0
  end if
  case potentialMerge of
    #vert:
      if (myRect[2] = mergeRect[4]) or (myRect[4] = mergeRect[2]) then
        potentialMerge = #success
      end if
    #horiz:
      if (myRect[1] = mergeRect[3]) or (myRect[3] = mergeRect[1]) then
        potentialMerge = #success
      end if
  end case
  if potentialMerge = #success then
    me.mergeRect(mergeRect)
    mergeZone.markForDeletion()
    return 1
  end if
  return 0
end

on calcLocs me
  pStartLoc = point(prect[1], prect[2])
  pEndLoc = point(prect[3], prect[4])
end

on calcRect me
  prect = rect(pStartLoc[1], pStartLoc[2], pEndLoc[1], pEndLoc[2])
end

on checkcollision me, gameObject, zoneType, newLoc, axesToUse
  zoneRect = me.getRect(zoneType)
  rectInfo = gameObject.calcCollisionRect(newLoc)
  newObjectRect = rectInfo.rect
  a = axesToUse
  if RectCollideRect(newObjectRect, zoneRect) then
    if me.zoneTypeIs(#collisionZone, zoneType, gameObject) then
      oldloc = gameObject.getLoc()
      oldRectInfo = gameObject.calcCollisionRect(oldloc)
      oldObjectRect = oldRectInfo.rect
      newObjectEdge = newObjectRect[a.objectRectSide]
      oldObjectEdge = oldObjectRect[a.objectRectSide]
      zoneEdge = zoneRect[a.zoneRectSide]
      if (a.zoneRectSide = 1) or (a.zoneRectSide = 2) then
        check = #moreThan
      else
        check = #lessThan
      end if
      collided = 0
      case check of
        #lessThan:
          if (newObjectEdge <= zoneEdge) and (oldObjectEdge >= zoneEdge) then
            collided = 1
          end if
        #moreThan:
          if (newObjectEdge >= zoneEdge) and (oldObjectEdge <= zoneEdge) then
            collided = 1
          end if
      end case
      if collided then
        newLoc[a.objectAxis] = zoneEdge - rectInfo.edgeOffset[a.objectRectSide]
        gameObject.collisionWithZone(zoneType)
        if zoneType = #platform then
          g.collisionMaster.setCollisionWithPlatform(1)
        end if
      end if
    else
    end if
  end if
  return newLoc
end

on display me
  case pSym of
    #ceiling:
      boxCol = rgb(255, 0, 255)
    #solid:
      boxCol = rgb(255, 255, 0)
    #platform:
      boxCol = rgb(0, 255, 0)
    otherwise:
      boxCol = rgb(255, 0, 0)
  end case
  pBox = g.objectMaster.requestObject(#objBox)
  params = pBox.getParams(#init)
  params.color = boxCol
  params.initialRect = me.getRect()
  pBox.init(params)
  pBox.display()
end

on getMarkedForDeletion me
  return pMarkedForDeletion
end

on getRect me, zoneType
  myRect = prect.duplicate()
  if (zoneType = #wallLeft) or (zoneType = #wallRight) then
    myRect[2] = myRect[2] + 1
  end if
  return myRect
end

on getSym me
  return pSym
end

on markForDeletion me
  me.setMarkedForDeletion(1)
end

on mergeRect me, therect
  newRect = me.getRect().union(therect)
  me.setRect(newRect)
end

on setEndLoc me, theloc
  pEndLoc = theloc.duplicate()
  me.calcRect()
end

on setMarkedForDeletion me, newVal
  pMarkedForDeletion = newVal
end

on setRect me, therect
  prect = therect.duplicate()
  me.calcLocs()
end

on setStartLoc me, theloc
  pStartLoc = theloc.duplicate()
  me.calcRect()
end

on typeEquals me, theType
  if theType = me.getSym() then
    return 1
  end if
  if me.getSym() = #solid then
    case theType of
      #platform, #wallLeft, #wallRight, #ceiling:
        return 1
    end case
  end if
end

on zoneTypeIs me, theType, zoneType, gameObject
  case theType of
    #collisionZone:
      case zoneType of
        #ceiling, #wallLeft, #wallRight:
          return 1
        #platform:
          if me.getSym() = #solid then
            return 1
          else
            return not gameObject.getAIPlatformDrop()
          end if
        otherwise:
          return 0
      end case
    otherwise:
      put "objZone.zoneTypeIs: collisionZone type not found"
  end case
end
