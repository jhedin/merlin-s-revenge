property pCurrentKeySet, pDefaultKeySet, pKeyBinding, pLastResults, pMoveKeyVectors, pMoveVector, pResults
global g, gKeySetFileName

on new me
  return me
end

on init me
  pCurrentKeySet = #none
  pDefaultKeySet = #wasd
  pKeyBinding = [:]
  pMoveVector = point(0, 0)
  pMoveKeyVectors = [:]
  m = pMoveKeyVectors
  m[#up] = point(0, -1)
  m[#down] = point(0, 1)
  m[#left] = point(-1, 0)
  m[#right] = point(1, 0)
  pResults = [:]
  keySet = me.loadKeySet()
  me.setKeySet(keySet)
end

on initResults me
  pResults = [:]
  repeat with i = 1 to pKeyBinding.count
    nProp = pKeyBinding.getPropAt(i)
    pResults[nProp] = 0
  end repeat
end

on finish me
  me.saveKeySet()
end

on checkKeys me
  pLastResults = pResults.duplicate()
  repeat with i = 1 to pKeyBinding.count
    nKeyNum = pKeyBinding[i]
    if keyPressed(nKeyNum) then
      pResults[i] = 1
      next repeat
    end if
    pResults[i] = 0
  end repeat
  me.updateMoveVector()
end

on checkOnce me, theKey
  if (pResults[theKey] = 1) and (pLastResults[theKey] = 0) then
    return 1
  end if
end

on getCurrentKeySet me
  return pCurrentKeySet
end

on getKeyFor me, theCommand
  keyNum = pKeyBinding[theCommand]
  keyText = g.keyChooseMaster.convertKeyNumToChar(keyNum)
  return keyText
end

on getKeyResult me, theKey
  return me.checkOnce(theKey)
end

on getMoveVector me
  return pMoveVector
end

on loadKeySet me
  keySet = getPref(gKeySetFileName)
  if keySet = VOID then
    keySet = pDefaultKeySet
  else
    keySet = symbol(keySet)
  end if
  return keySet
end

on saveKeySet me
  if ilk(pCurrentKeySet) <> #void then
    keySet = string(pCurrentKeySet)
    setPref(gKeySetFileName, keySet)
  end if
end

on setKeySet me, newValue
  pCurrentKeySet = newValue
  obj = g.collectionsMaster.getObject(#objKeyBinding, pCurrentKeySet)
  pKeyBinding = obj.getData()
  me.initResults()
  me.checkKeys()
end

on start me
end

on stop me
  me.finish()
end

on updateMoveVector me
  moveVector = point(0, 0)
  repeat with i = 1 to pMoveKeyVectors.count
    nDir = pMoveKeyVectors.getPropAt(i)
    if pResults[nDir] then
      moveVector = moveVector + pMoveKeyVectors[nDir]
    end if
  end repeat
  pMoveVector = moveVector
end
