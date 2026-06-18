on ListGetPosOfMinByProp thelist, theSym
  currentLowest = the maxinteger
  currentPos = #none
  i = 1
  repeat with nPropList in thelist
    nValue = nPropList[theSym]
    if nValue < currentLowest then
      currentLowest = nValue
      currentPos = i
    end if
    i = i + 1
  end repeat
  return currentPos
end
