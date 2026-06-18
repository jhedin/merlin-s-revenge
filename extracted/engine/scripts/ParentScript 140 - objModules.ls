property ancestor, pInstalledModules, pModules, pModulesInit

on new me
  ancestor = new(script("objModuleCatcher"))
  pInstalledModules = []
  pModulesInit = 0
  pModules = []
  return me
end

on addModule me, theMod
  me.includeModOnce(theMod)
end

on addModulesParams me
  me.id.bigMe.addModParams()
end

on createModules me
  objParams = ancestor
  prevMod = #none
  repeat with nModule in pModules
    nMod = new(script(nModule))
    nMod.setAncestor(objParams)
    if prevMod <> #none then
      prevMod.setAncestor(nMod)
    else
      me.setAncestor(nMod)
    end if
    prevMod = nMod
    pInstalledModules.append(symbol(nModule))
  end repeat
end

on getParams me, function
  if (pModules <> []) and (pModulesInit = 0) then
    me.createModules()
    me.addModulesParams()
    pModulesInit = 1
  end if
  return ancestor.getParams(function)
end

on includeModOnce me, theMod
  if pModules.getPos(theMod) < 1 then
    pModules.append(theMod)
  end if
end

on modIsInstalled me, theSym
  if pInstalledModules.getPos(theSym) > 0 then
    return 1
  end if
  return 0
end

on setAncestor me, newVal
  ancestor = newVal
end
