on SpriteGetRect pSpr
  sprRect = rect(0, 0, 0, 0)
  h = pSpr.height
  w = pSpr.width
  reg = pSpr.member.regPoint
  loc = pSpr.loc
  sprRect.left = loc.locH - reg.locH
  sprRect.top = loc.locV - reg.locV
  sprRect.right = loc.locH + (w - reg.locH)
  sprRect.bottom = loc.locV + (h - reg.locV)
  return sprRect
end
