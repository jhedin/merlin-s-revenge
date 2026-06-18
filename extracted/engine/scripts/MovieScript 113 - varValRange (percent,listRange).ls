on VarValRange perc, lRange
  if perc <= 0 then
    return lRange[1]
  else
    if perc >= 100 then
      return lRange[2]
    end if
  end if
  rangelength = VarDiff(lRange[1], lRange[2])
  rangestart = lRange[1]
  rangedir = VarMoreLess(lRange[1], lRange[2])
  perc = perc * 1.0
  val = perc / 100 * rangelength
  val = (val * rangedir) + rangestart
  return val
end
