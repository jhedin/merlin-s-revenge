property ancestor

on new me
  ancestor = new(script("objSpriteMember"))
  me.addModule("modColourTransform")
  return me
end
