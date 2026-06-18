property ancestor
global g

on new me
  ancestor = new(script("objController"))
  i = me.modifyParams(#init)
  i.exclusive = 0
  return me
end

on newObject me, definition, theloc, caller
  definitionText = StringEliminateChars(definition.text, RETURN)
  newObj = g.objectMaster.requestObject(#objPlayMusic)
  params = newObj.getParams(#init)
  params.definition = definitionText
  newObj.init(params)
  newObj.playMusic()
  me.pObjects.append(newObj)
  return newObj
end
