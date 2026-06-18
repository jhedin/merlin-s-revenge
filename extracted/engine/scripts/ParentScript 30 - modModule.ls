property ancestor

on new me
  return me
end

on addModParams me
  ancestor.addModParams()
end

on setAncestor me, newVal
  ancestor = newVal
end
