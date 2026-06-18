property ancestor, pColourRange, pNumRanges, pRangePercent

on new me
  ancestor = new(script("objEnergyBar"))
  i = me.modifyParams(#init)
  i[#colourRange] = [rgb(255, 0, 0), rgb(255, 255, 0), rgb(0, 200, 0)]
  return me
end

on init me, params
  me.setColourRange(params.colourRange)
  ancestor.init(params)
end

on setColourRange me, colourRange
  pColourRange = colourRange
  pNumRanges = pColourRange.count - 1
  pRangePercent = 100 / pNumRanges
end

on updateEnergy me, newEnergy
  ancestor.updateEnergy(newEnergy)
  energypercent = me.getCurrentEnergyPercent() * 1.0
  colRange = VarFloor(energypercent / pRangePercent) + 1
  colPercent = VarFloor(energypercent) mod pRangePercent * pNumRanges
  if colRange = 3 then
    newColour = pColourRange[colRange]
  else
    newColour = varColRange(colPercent, pColourRange[colRange], pColourRange[colRange + 1])
  end if
  me.setColour(newColour)
end
