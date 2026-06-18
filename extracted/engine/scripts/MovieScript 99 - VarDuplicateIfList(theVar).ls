on VarDuplicateIfList theVar
  if ilk(theVar, #list) then
    return theVar.duplicate()
  else
    return theVar
  end if
end
