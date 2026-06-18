on VarChangeinRange var, stran, firan, amcha
  var = var + amcha
  if var > firan then
    var = var - firan
  end if
  if var < stran then
    var = var + firan
  end if
  return var
end
