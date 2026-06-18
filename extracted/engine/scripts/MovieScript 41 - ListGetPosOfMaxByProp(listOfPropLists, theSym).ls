on ListGetPosOfMaxByProp thelist, theSym
  currentHighest = the maxinteger * -1
  currentPos = #none
  i = 1
  repeat with nPropList in thelist
    nValue = nPropList[theSym]
    if nValue > currentHighest then
      currentHighest = nValue
      currentPos = i
    end if
    i = i + 1
  end repeat
  return currentPos
end
