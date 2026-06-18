property ancestor, pGapY, pSizes, pStarImages, pTarget
global gGameEnergyBarLayer

on new me
  ancestor = new(script("objSpriteMember"))
  return me
end

on init me, params
  ancestor.init(params)
  pGapY = 4
  pSizes = [#large, #medium, #tiny]
  pStarImages = [:]
  si = pStarImages
  si[#tiny] = member("star_tiny", "gfx").image
  si[#medium] = member("star_medium", "gfx").image
  si[#large] = member("star_large", "gfx").image
  pTarget = #none
end

on calcImageHeight me, numOfStars
  imageHeight = 0
  sizes = pSizes
  repeat with size in sizes
    if numOfStars[size] > 0 then
      imageHeight = pStarImages[size].height
      exit repeat
    end if
  end repeat
  return imageHeight
end

on calcImageWidth me, numOfStars
  totalWidth = 0
  repeat with size in pSizes
    imageWidth = pStarImages[size].width
    widthForSize = imageWidth * numOfStars[size]
    totalWidth = totalWidth + widthForSize
  end repeat
  return totalWidth
end

on calcNumbersOfStars me, targetLevel
  numLarge = targetLevel / 10
  leftover = targetLevel - (numLarge * 10)
  numMedium = leftover / 5
  leftover = leftover - (numMedium * 5)
  numTiny = leftover
  nums = [#tiny: numTiny, #medium: numMedium, #large: numLarge]
  return nums
end

on clearTarget me
  pTarget = #none
  me.offscreen()
end

on constructStarsImage me
  targetLevel = pTarget.getExperienceLevel()
  myImage = me.drawStarsImage(targetLevel)
  me.setImage(myImage)
end

on displayAboveTarget me
  targetloc = pTarget.getLoc()
  targetReg = pTarget.getAnimMemberFromStrip(#stand).regPoint
  spr = me.getSprite()
  if spr.locZ <> gGameEnergyBarLayer then
    spr.locZ = gGameEnergyBarLayer
  end if
  ourLoc = point(0, 0)
  ourLoc.locH = targetloc.locH
  ourLoc.locV = targetloc.locV - targetReg.locV - spr.height + spr.member.regPoint.locV
  ourLoc.locV = ourLoc.locV - pGapY
  me.setSpriteLoc(ourLoc)
end

on drawStarsImage me, targetLevel
  numOfStars = me.calcNumbersOfStars(targetLevel)
  imageHeight = me.calcImageHeight(numOfStars)
  imageWidth = me.calcImageWidth(numOfStars)
  myImage = image(imageWidth, imageHeight, 32)
  me.drawStarsInImage(myImage, numOfStars)
  return myImage
end

on drawStarsInImage me, myImage, numOfStars
  destX1 = 0
  repeat with size in pSizes
    numStars = numOfStars[size]
    starImage = pStarImages[size]
    repeat with i = 1 to numStars
      srcRect = starImage.rect
      destX2 = destX1 + starImage.width
      starHeight = starImage.height
      imageHeight = myImage.height
      difference = imageHeight - starHeight
      destY1 = 0 + (difference / 2)
      destY2 = destY1 + starHeight
      destRect = rect(destX1, destY1, destX2, destY2)
      myImage.copyPixels(starImage, destRect, srcRect, [#ink: 36, #useFastQuads: 1])
      destX1 = destX1 + starImage.width
    end repeat
  end repeat
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #leaveGame, #outOfEnergy:
      if theObj = pTarget then
        me.offscreen()
        pTarget = #none
      end if
    #levelUp:
      if theObj = pTarget then
        me.constructStarsImage()
      end if
  end case
end

on getYGap me
  return pGapY
end

on setTarget me, theTarget
  if pTarget = theTarget then
    return 
  end if
  pTarget = theTarget
  me.constructStarsImage()
  me.keepMePosted(theTarget, #outOfEnergy, #once)
  me.keepMePosted(theTarget, #leaveGame, #once)
  me.keepMePosted(theTarget, #levelUp, #always)
end

on update me
  ancestor.update()
  if pTarget <> #none then
    me.displayAboveTarget()
  end if
end
