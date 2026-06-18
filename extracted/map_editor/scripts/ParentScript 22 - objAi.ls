property ancestor, pCharacterPrg, pmode, pSpr

on new me
  ancestor = new(script("objBasic"))
  return me
end

on init me
end

on initCharacterInfo me, characterPrg, spr
  pCharacterPrg = characterPrg.id.bigMe
  pSpr = spr
end

on characterModeChanged me, newMode
end

on ensureMode me, newMode
  if pmode <> newMode then
    me.id.bigMe.goMode(newMode)
  end if
end

on getLoc me
  return pCharacterPrg.getLoc()
end

on getFlip me
  return pCharacterPrg.getFlip()
end

on goMode me, newMode
  pmode = newMode
end
