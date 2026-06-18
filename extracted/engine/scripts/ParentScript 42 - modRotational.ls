property ancestor, pRotational

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  ancestor.init(params)
  pRotational = params.rotational
  me.initRotational()
end

on initRotational me
  if pRotational <> 0 then
    me.updateRotational()
  end if
end

on addModParams me
  i = me.modifyParams(#init)
  i[#rotational] = 1
  ancestor.addModParams()
end

on addSaveData me, sd
  sd[#pRotational] = pRotational
  ancestor.addSaveData(sd)
end

on restoreFromSave me, sd
  pRotational = sd.pRotational
  me.initRotational()
  ancestor.restoreFromSave(sd)
end

on update me
  if pRotational = 1 then
    me.updateRotational()
  end if
  ancestor.update()
end

on updateRotational me
  vect = me.id.bigMe.getVect()
  rot = GeomAngle(vect)
  me.id.bigMe.setSpriteRotation(rot)
end
