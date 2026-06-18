property pWeapons

on new me
  return me
end

on init me
  pWeapons = [:]
end

on assignWeapon me, weapon, enemyRef
  weapon.owner = enemyRef
end

on getWeapon me, enemyRef, weaponTypes
  return me.getNearestAvailableWeapon(enemyRef, weaponTypes)
end

on getNearestAvailableWeapon me, enemyRef, weaponTypes
  weapons = me.getWeaponsInOrderOfNearness(enemyRef, weaponTypes)
  weapon = me.getWeaponFirstAvailable(weapons, enemyRef)
  if weapon <> #none then
    me.assignWeapon(weapon, enemyRef)
    weaponRef = weapon.objRef
  else
    weaponRef = #none
  end if
  return weaponRef
end

on getWeaponFirstAvailable me, weapons, enemyRef
  repeat with weapon in weapons
    if (weapon.owner = #none) or (weapon.owner = enemyRef) then
      return weapon
      next repeat
    end if
    if weapon.objRef.isCarried() = 0 then
      ownerDist = geomPixelDist(weapon.owner.getLoc(), weapon.objRef.getLoc())
      if ownerDist > weapon.dist then
        weapon.owner.lostWeapon()
        return weapon
      end if
    end if
  end repeat
  return #none
end

on getWeaponsInOrderOfNearness me, enemyRef, weaponTypes
  weapons = []
  repeat with weaponType in weaponTypes
    nWeaponList = pWeapons[weaponType]
    if nWeaponList <> VOID then
      repeat with nWeapon in nWeaponList
        enemyLoc = enemyRef.getLoc()
        weaponLoc = nWeapon.objRef.getLoc()
        dist = geomPixelDist(enemyLoc, weaponLoc)
        nWeapon[#dist] = dist
        weapons.append(nWeapon)
      end repeat
    end if
  end repeat
  weapons = ListSortByProp(weapons, #dist)
  return weapons
end

on register me, objType, objRef
  if pWeapons[objType] = VOID then
    pWeapons[objType] = []
  end if
  pWeapons[objType].append([#objRef: objRef, #myType: objType, #owner: #none])
  ListPrint(pWeapons)
end

on unRegister me, objType, objRef
  weaponPos = pWeapons[objType].getPos(objRef)
  if weaponPos > 0 then
    pWeapons.deleteAt(weaponPos)
  end if
  ListPrint(pWeapons)
end

on start me
end

on stop me
end
