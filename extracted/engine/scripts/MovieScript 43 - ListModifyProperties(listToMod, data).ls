on ListModifyProperties params, data
  repeat with i = 1 to data.count
    nProp = data.getPropAt(i)
    if ilk(params[nProp], #propList) then
      ListModifyProperties(params[nProp], data[nProp])
      next repeat
    end if
    params[nProp] = data[nProp]
  end repeat
  return params
end
