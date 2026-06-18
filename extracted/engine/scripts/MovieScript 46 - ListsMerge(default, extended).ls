on ListsMerge propListDefault, propListExtended
  countExtended = propListExtended.count
  repeat with i = 1 to countExtended
    nProp = propListExtended.getPropAt(i)
    nValue = propListExtended[i]
    propListDefault[nProp] = nValue
  end repeat
  return propListDefault
end
