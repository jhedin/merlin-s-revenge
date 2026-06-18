on RectFloor therect
  repeat with r = 1 to 4
    therect[r] = VarFloor(therect[r])
  end repeat
  return therect
end
