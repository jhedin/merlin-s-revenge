property ancestor

on new me
  ancestor = new(script("objCharacter"))
  me.addModule("modFader")
  me.addModule("modPositioning")
  me.addModule("modProp")
  me.addModule("modStretcher")
  me.addModule("modTeleport")
  me.addModule("modThespian")
  me.addModule("modWastedMode")
  return me
end

on checkCollisions me, newLoc
  return newLoc
end
