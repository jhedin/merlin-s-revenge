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
  definition = value(definitionText)
  newObj = g.objectMaster.requestObject(#objMenuBackground)
  params = newObj.getParams(#init)
  params.definition = definition
  params.location = theloc
  params.tileSet = g.collectionsMaster.getObj(#objTileSetKey, #menu)
  newObj.init(params)
  newObj.display()
  me.pObjects.append(newObj)
  return newObj
end
