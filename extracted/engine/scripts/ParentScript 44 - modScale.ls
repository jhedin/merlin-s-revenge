property ancestor, pAdditionalHeight, pAdditionalHeightRatio, pAdditionalWidth, pAdditionalWidthRatio

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pAdditionalHeight = 0
  pAdditionalHeightRatio = 1
  pAdditionalWidth = 0
  pAdditionalWidthRatio = 1
end

on applyExtraDimensions me
  if (pAdditionalHeight = 0) and (pAdditionalWidth = 0) then
    return 
  end if
  if me.big.getAnimKeepSize() then
    return 
  end if
  newHeight = me.getScaleHeight()
  newWidth = me.getScaleWidth()
  me.big.setSpriteHeight(newHeight)
  me.big.setSpriteWidth(newWidth)
end

on getScaleHeight me
  myMember = me.big.getAnimMember()
  myHeight = myMember.height
  newHeight = myHeight * pAdditionalHeightRatio
  return newHeight
end

on getScaleWidth me
  myMember = me.big.getAnimMember()
  mywidth = myMember.width
  newWidth = mywidth * pAdditionalWidthRatio
  return newWidth
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #animUpdated:
      me.applyExtraDimensions()
  end case
end

on setAdditionalHeight me, newVal
  pAdditionalHeight = newVal
  standMember = me.big.getAnimMemberFromStrip(#stand)
  heightRatio = (standMember.height + newVal) * 1.0 / standMember.height
  pAdditionalHeightRatio = heightRatio
end

on setAdditionalWidth me, newVal
  pAdditionalWidth = newVal
  standMember = me.big.getAnimMemberFromStrip(#stand)
  widthRatio = (standMember.width + newVal) * 1.0 / standMember.width
  pAdditionalWidthRatio = widthRatio
end
