on PointTowardZero aPoint, amount
  if ilk(amount) <> #point then
    amount = point(amount, amount)
  end if
  aPoint[1] = VarToward(aPoint[1], 0, amount[1])
  aPoint[2] = VarToward(aPoint[2], 0, amount[2])
  return aPoint
end
