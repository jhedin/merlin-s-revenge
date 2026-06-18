property ancestor
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on PlaySound me, theSound, theVol
  if theSound <> #none then
    g.soundmaster.PlaySound(theSound, theVol)
  end if
end
