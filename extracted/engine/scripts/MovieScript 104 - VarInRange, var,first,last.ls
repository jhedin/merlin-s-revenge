on VarInRange var, first, fin
  if ilk(first, #list) then
    fin = first[2]
    first = first[1]
  end if
  if (var < (max(first, fin) + 1)) and (var > (min(first, fin) - 1)) then
    inrange = 1
  else
    inrange = 0
  end if
  return inrange
end
