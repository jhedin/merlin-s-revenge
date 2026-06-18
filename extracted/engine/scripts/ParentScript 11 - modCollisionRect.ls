property ancestor, pBox, pCollisionRect, pCollisionRectClipTop, pCollisionRectMax, pCollisionRectType
global g, gGameView

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  clipTop = 0
  i = me.modifyParams(#init)
  i[#collisionRect] = #none
  i[#collisionRectClipTop] = clipTop
  i[#collisionRectType] = #fixed
  ancestor.addModParams()
end

on init me, params
  pBox = #none
  if ilk(params.collisionRect, #rect) then
    pCollisionRect = params.collisionRect.duplicate()
  else
    pCollisionRect = params.collisionRect
  end if
  pCollisionRectClipTop = params.collisionRectClipTop
  pCollisionRectMax = rect(-16, -16, 16, 16)
  pCollisionRectType = params.collisionRectType
  ancestor.init(params)
end

on initRectFromCurrentImage me
  currentMember = me.big.getAnimMember()
  currentRegPoint = currentMember.regPoint
  currentHeight = currentMember.height
  currentWidth = currentMember.width
  collisionRect = rect(0, 0, 0, 0)
  collisionRect[1] = currentRegPoint[1] * -1
  collisionRect[2] = currentRegPoint[2] * -1
  collisionRect[3] = currentWidth - currentRegPoint[1]
  collisionRect[4] = currentHeight - currentRegPoint[2]
  collisionRect[1] = max(collisionRect[1], pCollisionRectMax[1])
  collisionRect[2] = max(collisionRect[2], pCollisionRectMax[2])
  collisionRect[3] = min(collisionRect[3], pCollisionRectMax[3])
  collisionRect[4] = min(collisionRect[4], pCollisionRectMax[4])
  collisionRect = collisionRect.inflate(-1, -1)
  pCollisionRect = collisionRect
end

on finish me
  me.finishBox()
  ancestor.finish()
end

on finishBox me
  if pBox <> #none then
    pBox.finish()
  end if
end

on calcCollisionRect me, theloc
  if (pCollisionRect = #none) or (pCollisionRectType = #dynamic) then
    me.initRectFromCurrentImage()
  end if
  newRect = pCollisionRect + rect(theloc, theloc)
  newRect[2] = newRect[2] + pCollisionRectClipTop
  info = [#edgeOffset: pCollisionRect.duplicate(), #rect: newRect]
  return info
end

on displayRect me, therect
  me.finishBox()
  pBox = g.objectMaster.requestObject(#objBox)
  params = pBox.getParams(#init)
  params.color = rgb(0, 255, 0)
  params.initialRect = therect.duplicate()
  pBox.init(params)
end

on getCollisionRect me
  rectInfo = me.calcCollisionRect(me.getLoc())
  return rectInfo.rect
end
