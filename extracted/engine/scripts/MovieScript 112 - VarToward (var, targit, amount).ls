on VarToward var, targit, amount
  if var > targit then
    var = var - amount
    if var < targit then
      var = targit
    end if
  end if
  if var < targit then
    var = var + amount
    if var > targit then
      var = targit
    end if
  end if
  return var
end
