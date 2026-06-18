on VarMoreLess firV, secV
  if firV > secV then
    res = -1
  end if
  if firV < secV then
    res = 1
  end if
  if firV = secV then
    res = 0
  end if
  return res
end
