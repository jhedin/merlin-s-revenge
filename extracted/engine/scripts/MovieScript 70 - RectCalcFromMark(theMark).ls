on RectCalcFromMark theMark
  therect = rect(0, 0, 0, 0)
  therect.left = theMark.loc.locH
  therect.top = theMark.loc.locV
  therect.right = theMark.loc.locH + theMark.width
  therect.bottom = theMark.loc.locV + theMark.height
  return therect
end
