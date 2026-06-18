property ancestor, pLastMsg, pSpr
global g

on new me
  me.ancestor = new(script("objBasic"))
  me.init()
  return me
end

on init me
  pSpr = g.spriteMaster.requestSprite()
  pSpr.member = member("output", "gfx")
  pSpr.loc = point(0, 0)
  pSpr.locZ = 999
end

on msg me, theMsg
  theMsg = string(theMsg)
  if theMsg <> pLastMsg then
    pSpr.member.text = theMsg
  end if
  pLastMsg = theMsg
end
