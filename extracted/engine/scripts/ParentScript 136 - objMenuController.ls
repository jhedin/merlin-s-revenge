property ancestor, pFont, pRequester, pTileSet
global g, gMenuLayer, gMenuTextLayer, r

on new me
  ancestor = new(script("objController"))
  i = me.modifyParams(#init)
  i[#fontObj] = g.collectionsMaster.getObj(#objFont, #menu)
  i[#requester] = #none
  i[#tileSet] = g.collectionsMaster.getObj(#objTileSetKey, #menu)
  return me
end

on init me, params
  ancestor.init(params)
  pFont = params.fontObj
  pRequester = params.requester
  pTileSet = params.tileSet
end

on menuClosed me, theMenu
  if pRequester <> #none then
    pRequester.menuClosed(theMenu)
  end if
end

on newDialogue me, theTitle, thelist, theLocation
  def = EMPTY
  def = def & theTitle & r
  repeat with itm in thelist
    def = def & itm & " | #" & itm & r
  end repeat
  if thelist.count > 0 then
    def = def & "-" & r
  end if
  def = def & "exit | #exit"
  me.newObject(def, theLocation)
end

on newObject me, definition, location, caller
  numMenus = me.pObjects.count
  if ilk(definition, #member) then
    definition = definition.text
  end if
  if caller = VOID then
    requester = me
  else
    requester = caller
  end if
  nMenu = g.objectMaster.requestObject(#objMenu)
  params = nMenu.getParams(#init)
  params.fontObj = pFont
  params.layer = gMenuLayer + numMenus
  params.location = location
  params.definitionTxt = definition
  params.requester = requester
  params.textLayer = gMenuTextLayer + numMenus
  params.tileSet = pTileSet
  params = ancestor.newObject(params)
  nMenu.init(params)
  nMenu.display()
  me.pObjects.append(nMenu)
  return nMenu
end

on newPropertyDialogue me, theTitle, thePropList, theLocation
  def = EMPTY
  def = def & theTitle & r
  repeat with i = 1 to thePropList.count
    nVal = thePropList[i]
    nProp = thePropList.getPropAt(i)
    def = def & nProp & " > " & nVal & r
  end repeat
  if thePropList.count > 0 then
    def = def & "-" & r
  end if
  def = def & "exit | #exit"
  me.newObject(def, theLocation)
end

on optionNotFound me, theComm, menuSym
  pRequester.menuSelection(theComm, menuSym)
end
