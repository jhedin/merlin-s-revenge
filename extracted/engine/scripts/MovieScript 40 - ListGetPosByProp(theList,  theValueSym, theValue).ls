on ListGetPosByProp thelist, theValueSym, theValue
  i = 0
  pos = 0
  repeat with nPropList in thelist
    i = i + 1
    if nPropList[theValueSym] = theValue then
      pos = i
      exit repeat
    end if
  end repeat
  return pos
end
