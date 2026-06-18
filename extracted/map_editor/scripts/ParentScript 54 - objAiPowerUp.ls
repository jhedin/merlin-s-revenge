property ancestor, pPlayer

on new me
  ancestor = new(script("objAi"))
  return me
end

on init me, player
  pPlayer = player
  me.goMode(#norm)
end

on update me
  case me.pmode of
    #norm:
      if me.pCharacterPrg.checkForCollisionWithPlayer() then
        me.pCharacterPrg.collected()
        me.pCharacterPrg.setDead(1)
        me.goMode(#dead)
      end if
  end case
end
