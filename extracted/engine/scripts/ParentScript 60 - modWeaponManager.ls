property ancestor, pCooldownCounters, pCurrentWeapon, pStartingWeapon, pWeapons
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  pCooldownCounters = [:]
  pCurrentWeapon = #none
  pStartingWeapon = params.weapon
  pWeapons = [:]
  ancestor.init(params)
end

on start me
  me.initNaturalAttack()
  me.initStartingWeapon(pStartingWeapon)
  ancestor.start()
end

on addModParams me
  i = me.modifyParams(#init)
  i[#weapon] = #none
  i[#bufferDist] = 100
  i[#multiAttack] = 0
  ancestor.addModParams()
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pCooldownCounters] = pCooldownCounters
  sd[#pCurrentWeapon] = pCurrentWeapon
  sd[#pWeapons] = pWeapons
end

on initNaturalAttack me
  naturalAttack = me.id.bigMe.getAttack()
  if naturalAttack <> #none then
    me.addWeapon(naturalAttack.name, naturalAttack)
  end if
end

on initStartingWeapon me, theWeapon
  if theWeapon = #none then
    return 
  end if
  weaponParams = g.actorMaster.getActorData(theWeapon)
  theAttack = weaponParams.attack
  me.addWeapon(theWeapon, theAttack)
end

on addWeapon me, theWeapon, theAttack
  pWeapons[theWeapon] = theAttack
  me.addCooldownCounter(theWeapon)
  me.setCurrentWeapon(theWeapon)
end

on addCooldownCounter me, theWeapon
  theAttack = pWeapons[theWeapon]
  pCooldownCounters[theWeapon] = CounterNew()
  c = pCooldownCounters[theWeapon]
  c.tim[2] = theAttack.cooldown
  c.fin = 1
  AttackSetTypeFromAnimType(theAttack)
  case theAttack.type of
    #melee:
      c.inc = me.big.getAgility()
    #ranged:
      c.inc = me.big.getDexterity()
    #magic:
      c.inc = me.big.getManaRegeneration()
  end case
end

on getCooldownFin me
  return pCooldownCounters[pCurrentWeapon].fin
end

on getCurrentWeapon me
  return pCurrentWeapon
end

on getWeapons me, theType
  weapons = []
  repeat with i = 1 to pWeapons.count
    nWeapon = pWeapons[i]
    if me.weaponIsOfType(nWeapon, theType) then
      nSym = pWeapons.getPropAt(i)
      weapons.append(nSym)
    end if
  end repeat
  return weapons
end

on resetCooldown me
  CounterReset(pCooldownCounters[pCurrentWeapon])
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pCooldownCounters = sd.pCooldownCounters
  pCurrentWeapon = sd.pCurrentWeapon
  pWeapons = sd.pWeapons
  if pCurrentWeapon <> #none then
    attack = pWeapons[pCurrentWeapon].duplicate()
    me.big.setAttack(attack)
  end if
end

on selectSpell me, num
  mySpells = me.getWeapons(#magic)
  if mySpells.count >= num then
    Spell = mySpells[num]
    me.setCurrentWeapon(Spell)
  end if
end

on setCurrentWeapon me, theWeapon
  if pWeapons[theWeapon].animType <> #magic then
    me.id.bigMe.cancelAttack()
  end if
  pCurrentWeapon = theWeapon
  attack = pWeapons[theWeapon].duplicate()
  me.id.bigMe.setAttack(attack)
end

on update me
  ancestor.update()
  me.updateCooldowns()
end

on updateCooldowns me
  repeat with cooldownCounter in pCooldownCounters
    CounterOnce(cooldownCounter)
  end repeat
end

on setMultiAttack me, multiAttack, bufferDist
  if multiAttack then
    if pWeapons.count > 1 then
      targetObj = me.id.bigMe.pAI.getRelation(#target)
      targetloc = me.id.bigMe.getTargetLoc()
      if (targetObj = #none) or (targetloc = #none) then
        me.setCurrentWeapon(pWeapons[1].name)
        exit
      end if
      attackLoc = me.id.bigMe.getLoc()
      disttotarget = GeomDistSqr(targetloc, attackLoc)
      if pWeapons[2].type = #ranged then
        bufferDist = pWeapons[2].reach
      end if
      attackDist = disttotarget - (bufferDist * bufferDist)
      if attackDist > 0 then
        me.setCurrentWeapon(pWeapons[1].name)
      else
        case targetObj.getAttack().type of
          #melee:
            if (disttotarget > 20) and (pWeapons[2].type = #melee) then
              me.setCurrentWeapon(pWeapons[1].name)
            else
              me.setCurrentWeapon(pWeapons[2].name)
            end if
          otherwise:
            me.setCurrentWeapon(pWeapons[2].name)
        end case
      end if
    end if
  end if
end

on weaponIsOfType me, theWeapon, theType
  match = 0
  case theType of
    #magic:
      match = theWeapon.animType = theType
    #nonMagic:
      match = theWeapon.animType <> #magic
  end case
  return match
end
