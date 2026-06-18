on VarHalfWay var1, var2
  diff = VarDiff(var1, var2)
  halfWay = max(var1, var2) - (diff / 2)
  return halfWay
end
