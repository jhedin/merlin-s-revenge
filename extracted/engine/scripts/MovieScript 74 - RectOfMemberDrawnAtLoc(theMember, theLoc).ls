on RectOfMemberDrawnAtLoc theMember, theloc
  theRegPoint = theMember.regPoint
  memWidth = theMember.width
  memHeight = theMember.height
  leftOffset = 0 - theRegPoint.locH
  rightOffset = memWidth - theRegPoint.locH
  topOffset = 0 - theRegPoint.locV
  bottomOffset = memHeight - theRegPoint.locV
  theLeft = theloc.locH + leftOffset
  theRight = theloc.locH + rightOffset
  theTop = theloc.locV + topOffset
  theBottom = theloc.locV + bottomOffset
  therect = rect(theLeft, theTop, theRight, theBottom)
  return therect
end
