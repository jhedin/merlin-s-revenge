on varColRange percent, col1, col2
  col = []
  col[1] = VarValRange(percent, [col1.red, col2.red])
  col[2] = VarValRange(percent, [col1.green, col2.green])
  col[3] = VarValRange(percent, [col1.blue, col2.blue])
  colRGB = rgb(col[1], col[2], col[3])
  return colRGB
end
