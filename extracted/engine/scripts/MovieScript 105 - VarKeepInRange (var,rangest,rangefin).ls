on VarKeepInRange var, rangest, rangefin
  if var > rangefin then
    var = rangefin
  end if
  if var < rangest then
    var = rangest
  end if
  return var
end
