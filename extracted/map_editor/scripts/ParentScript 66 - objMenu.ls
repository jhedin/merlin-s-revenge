property ancestor, pAutoClose, pBaseColor, pButtons, pContentStartRow, pDefinitionTxt, pDefinition, pEditFieldColumn, pEditFields, pEditFieldWidth, pHiColor, pImageMember, player, pLocation, pMargin, pMenuController, pMinHeight, pMinWidth, pRequester, pSpr, pTextLayer, pTileMap, pTileSet, pTitleDividerRow, pTitleMember, pTitleSprite, pFont
global g, gMenuLayer, gMenuTextLayer

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#autoClose] = 1
  i[#baseColor] = rgb(255, 255, 255)
  i[#contentStartRow] = 4
  i[#definitionTxt] = EMPTY
  i[#editFieldWidth] = 200
  i[#fontObj] = #none
  i[#hiColor] = rgb(100, 100, 100)
  i[#layer] = gMenuLayer
  i[#location] = point(10, 10)
  i[#margin] = 4
  i[#minWidth] = 30
  i[#minHeight] = 30
  i[#requester] = #none
  i[#textLayer] = gMenuTextLayer
  i[#tileSet] = #none
  i[#titleDividerRow] = 3
  return me
end

on init me, params
  pAutoClose = params.autoClose
  pBaseColor = params.baseColor
  pContentStartRow = params.contentStartRow
  pDefinition = [:]
  pDefinitionTxt = params.definitionTxt
  pEditFieldWidth = params.editFieldWidth
  pFont = params.fontObj
  pHiColor = params.hiColor
  player = params.layer
  pLocation = params.location
  pMargin = params.margin
  pMinHeight = params.minHeight
  pMinWidth = params.minWidth
  pRequester = params.requester
  pTextLayer = params.textLayer
  pTileSet = params.tileSet
  pTitleDividerRow = params.titleDividerRow
  pButtons = []
  pEditFields = []
  pEditFieldColumn = #none
  pMenuController = g.controllerMaster.getController(#menu)
  pTileMap = #none
  pTitleMember = #none
  pTitleSprite = g.spriteMaster.requestSprite()
  pSpr = g.spriteMaster.requestSprite()
  pTitleSprite.locZ = pTextLayer
  pSpr.locZ = player
end

on finish me
  if pTileSet <> #none then
    pTileSet.finish()
  end if
  g.memberMaster.freeMember(pImageMember)
  g.memberMaster.freeMember(pTitleMember)
  g.objectMaster.finishObjects(pButtons)
  g.objectMaster.finishObjects(pEditFields)
  g.spriteMaster.freeSprite(pTitleSprite)
  g.spriteMaster.freeSprite(pSpr)
  ancestor.finish()
  pMenuController.objectFinished(me)
end

on buttClicked me, theComm
  if theComm = #exit then
    if pRequester <> #none then
      pRequester.menuClosed(pDefinition.sym)
    end if
    me.finish()
  else
    case pDefinition.sym of
      #Load_a_Map:
        g.mapEditMaster.loadMap(theComm)
      #test_menu:
        case theComm of
          #testSave:
            pMenuController.newObject(member("dd_menu_test_save", "gfx"), me.getNextLocation())
          #testLoad:
            put "loading..."
          #testOption3:
            put "option 3"
        end case
      #start_menu:
        case theComm of
          #load:
            g.mapEditMaster.loadClicked(me)
        end case
      otherwise:
        pRequester.optionNotFound(theComm, pDefinition.sym)
        if pAutoClose then
          me.finish()
        end if
    end case
  end if
end

on calcMenuHeight me
  menHeight = pMinHeight
  def = pDefinition
  itms = def.items
  lineSpacing = pTileSet.getTileSize()[2]
  linesRequired = itms.count
  linesRequired = linesRequired + 2
  heightRequired = linesRequired * lineSpacing
  if heightRequired > menHeight then
    menHeight = heightRequired
  end if
  return menHeight
end

on calcMenuWidth me
  menWidth = pMinWidth
  def = pDefinition
  itms = def.items
  if def.titleImage.width > pMinWidth then
    menWidth = def.titleImage.width
  end if
  repeat with itm in itms
    nImage = itm.displayImage
    nWidth = nImage.width
    if itm.type = #editField then
      nWidth = nWidth + pEditFieldWidth
    end if
    if nWidth > menWidth then
      menWidth = nWidth
      pEditFieldColumn = nWidth - pEditFieldWidth
    end if
  end repeat
  return menWidth
end

on activate me
  repeat with nButton in pButtons
    nButton.activate()
  end repeat
end

on deactivate me
  repeat with nButton in pButtons
    nButton.deactivate()
  end repeat
end

on display me
  me.interpretDefinition()
  me.getItemTextImages()
  me.initTileMap()
  me.plotTileMapOutline()
  me.plotTileMapContents()
  myImage = me.getImage()
  me.displayInSprite(myImage)
  me.displayTitleImage()
  me.startItems()
end

on displayInSprite me, myImage
  pImageMember = g.memberMaster.requestMember(#bitmap, "menu")
  pImageMember.image = myImage
  pImageMember.regPoint = point(0, 0)
  SpriteSetMember(pSpr, pImageMember)
  pSpr.loc = pLocation
end

on displayTitleImage me
  titleText = pDefinition.title
  titleImage = pDefinition.titleImage
  pTitleMember = g.memberMaster.requestMember(#bitmap, titleText)
  pTitleMember.image = titleImage
  pTitleMember.regPoint = point(0, 0)
  SpriteSetMember(pTitleSprite, pTitleMember)
  pTitleSprite.loc = pLocation + (pTileSet.getTileSize() * point(pMargin, 1))
  pTitleSprite.color = pBaseColor.duplicate()
end

on getItemTextImages me
  def = pDefinition
  itms = def.items
  def.titleImage = pFont.getString(def.title)
  repeat with itm in itms
    itm.displayImage = pFont.getString(itm.displayText)
  end repeat
end

on getNextLocation me
  return pLocation + pTileSet.getTileSize()
end

on initTileMap me
  thewidth = me.calcMenuWidth()
  theheight = me.calcMenuHeight()
  if pTileMap <> #none then
    pTileMap.finish()
    pTileMap = #none
  end if
  tilesize = pTileSet.getTileSize()
  tilesWide = (thewidth / tilesize[1]) + (2 * pMargin)
  tilesHigh = (theheight / tilesize[2]) + 2
  pTileMap = g.objectMaster.requestObject(#objTileMap)
  params = pTileMap.getParams(#init)
  params.tileSet = pTileSet
  params.mapSize = point(tilesWide, tilesHigh)
  pTileMap.init(params)
end

on interpretDefinition me
  def = g.structMaster.getStruct(#menuDefinition)
  defTxt = pDefinitionTxt
  numLines = defTxt.lines.count
  repeat with i = 1 to numLines
    nLine = defTxt.line[i]
    if i = 1 then
      def.title = nLine
      def.sym = symbol(StringCharReplace(nLine, " ", "_"))
      next repeat
    end if
    def.items.append(me.interpretItemDefinition(nLine))
  end repeat
  pDefinition = def
end

on interpretDivider me, nLine, menItem
  divPos = StringGetPos(nLine, "|")
  divType = #option
  if divPos = 0 then
    divPos = StringGetPos(nLine, ">")
    divType = #editField
  end if
  menItem.type = divType
  return divPos
end

on interpretItemDefinition me, nLine
  menItem = g.structMaster.getStruct(#menuItem)
  dividerPos = me.interpretDivider(nLine, menItem)
  menItem.displayText = nLine.char[1..dividerPos - 2]
  menItem.comm = value(nLine.char[dividerPos + 2..99])
  return menItem
end

on getImage me
  myImage = pTileMap.getImage()
  return myImage
end

on plotTileMapContents me
  me.plotTileMapDividers()
end

on plotTileMapDivider me, ty
  mapSize = pTileMap.getSize()
  mapSizeX = mapSize[1]
  mapSizeY = mapSize[2]
  repeat with tx = 1 to mapSizeX
    case tx of
      1:
        nTile = #dividerLeft
      mapSizeX:
        nTile = #dividerRight
      otherwise:
        nTile = #dividerCenter
    end case
    pTileMap.poke(point(tx, ty), nTile)
  end repeat
end

on plotTileMapDividers me
  itms = pDefinition.items
  titleDividerRow = pTitleDividerRow
  contentStartRow = pContentStartRow
  me.plotTileMapDivider(titleDividerRow)
  itmNum = 0
  repeat with itm in itms
    if itm.displayText = "-" then
      me.plotTileMapDivider(contentStartRow + itmNum)
    end if
    itmNum = itmNum + 1
  end repeat
end

on plotTileMapOutline me
  mapSize = pTileMap.getSize()
  mapSizeX = mapSize[1]
  mapSizeY = mapSize[2]
  repeat with ty = 1 to mapSizeY
    repeat with tx = 1 to mapSizeX
      case tx of
        1:
          case ty of
            1:
              nTile = #topLeft
            mapSizeY:
              nTile = #bottomLeft
            otherwise:
              nTile = #middleLeft
          end case
        mapSizeX:
          case ty of
            1:
              nTile = #topRight
            mapSizeY:
              nTile = #bottomRight
            otherwise:
              nTile = #middleRight
          end case
        otherwise:
          case ty of
            1:
              nTile = #topCenter
            mapSizeY:
              nTile = #bottomCenter
            otherwise:
              nTile = #middleCenter
          end case
      end case
      pTileMap.poke(point(tx, ty), nTile)
    end repeat
  end repeat
end

on startEditField me, textLocation, itm
  location = textLocation + pEditFieldColumn
  nEditField = g.objectMaster.requestObject(#objEditField)
  params = nEditField.getParams(#init)
  params.layer = pTextLayer
  params.location = location
  nEditField.init(params)
  nEditField.display()
  pEditFields.append(nEditField)
end

on startItems me
  itms = pDefinition.items
  startRow = pContentStartRow - 1
  itmNo = 0
  repeat with itm in itms
    ty = startRow + itmNo
    itmNo = itmNo + 1
    if itm.displayText = "-" then
      next repeat
    end if
    nImage = itm.displayImage
    nButton = g.objectMaster.requestObject(#objImageButton)
    nOffset = pTileSet.getTileSize() * point(pMargin, ty)
    params = nButton.getParams(#init)
    params.baseColor = pBaseColor
    params.callingPrg = me
    params.commSym = itm.comm
    params.location = pLocation + nOffset
    params.layer = pTextLayer
    params.hiColor = pHiColor
    params.myImage = nImage
    nButton.init(params)
    if itm.type = #option then
      nButton.activate()
    end if
    if itm.type = #editField then
      me.startEditField(params.location.duplicate())
    end if
    pButtons.append(nButton)
  end repeat
end
