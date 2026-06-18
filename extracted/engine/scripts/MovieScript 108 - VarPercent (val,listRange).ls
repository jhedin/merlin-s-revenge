on varPercent val, lRange
  if val < min(lRange[1], lRange[2]) then
    return 0
  else
    if val > max(lRange[1], lRange[2]) then
      return 100
    end if
  end if
  rangelength = VarDiff(lRange[1], lRange[2])
  strange = lRange[1] * 1.0
  rangedir = VarMoreLess(lRange[1], lRange[2])
  valpos = (val - strange) * 1.0
  valpercent = valpos / rangelength * 100 * rangedir
  return valpercent
end
