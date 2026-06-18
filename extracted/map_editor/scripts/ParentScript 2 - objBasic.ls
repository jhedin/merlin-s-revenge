property id, pFlags

on new me
  pFlags = []
  return me
end

on finish me
  id.master.objFree(id)
end
