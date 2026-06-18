property ancestor, pMyWeapon, pUnarmedAttack
global g

on new me
  ancestor = new(script("objAiEnemy"))
  return me
end

on init me, player
  ancestor.init(player)
  pMyWeapon = #none
end

on initCharacterInfo me, characterPrg, spr, params
  ancestor.initCharacterInfo(characterPrg, spr, params)
  pUnarmedAttack = me.pAttack.duplicate()
end

on characterModeChanged me, newCharMode
  case newCharMode of
    #reel_fly:
      me.dropWeapon()
  end case
  case newCharMode of
    #look:
      me.goMode(#seekWeapon)
    #walk:
      if me.pmode = #seekWeapon then
        me.goMode(#collectWeapon)
      else
        me.goMode(#seekWeapon)
        me.goMode(#collectWeapon)
      end if
    otherwise:
      ancestor.characterModeChanged(newCharMode)
  end case
end

on dropWeapon me
  if pMyWeapon <> #none then
    if pMyWeapon.isCarried() then
      pMyWeapon.drop()
      me.droppedWeapon()
    end if
  end if
end

on droppedWeapon me
  me.setAttack(pUnarmedAttack.duplicate())
end

on goMode me, newMode
  case newMode of
    #seekWeapon:
      pMyWeapon = g.weaponMaster.getWeapon(me, [#pan, #pad, #pug, #sci, #spd, #swd])
    #collectWeapon:
      nothing()
  end case
  if pMyWeapon <> #none then
    pMyWeapon.AiModeChanged(newMode)
  end if
  ancestor.goMode(newMode)
end

on lostWeapon me
  pMyWeapon = #none
end

on pickUpWeapon me
  pMyWeapon.pickedUp(me)
  attack = pMyWeapon.getAttack()
  me.setAttack(attack)
end

on update me
  case me.pmode of
    #collectWeapon:
      fin = me.updateCollectWeapon()
      if fin then
        me.id.bigMe.goMode(#moveToAttack)
      end if
  end case
  ancestor.update()
end

on updateCollectWeapon me
  if pMyWeapon = #none then
    return 1
  end if
  therect = pMyWeapon.getRect()
  fin = me.updateMoveToRect(therect, 1)
  if fin then
    me.pickUpWeapon()
  end if
  return fin
end
