property ancestor, pAutoClose, pBaseColor, pButtons, pContentStartRow, pDefinitionTxt, pDefinition, pEditFieldColumn, pEditFields, pEditFieldWidth, pHiColor, pImageMember, player, pLocation, pMargin, pMenuController, pMinHeight, pMinWidth, pPulse, pRequester, pShadowedColor, pSpr, pTextLayer, pTileMap, pTileSet, pTitle, pTitleDividerRow, pTitleMember, pTitleSprite, pFont
global g, gMenuLayer, gMenuTextLayer, gMenuBaseColour, gMenuHiColour, gMenuPulse, gMenuShadowedColour

on new me
  ancestor = new(script("objModules"))
  i = me.modifyParams(#init)
  i[#autoClose] = 1
  i[#baseColor] = gMenuBaseColour
  i[#contentStartRow] = 4
  i[#definitionTxt] = EMPTY
  i[#editFieldWidth] = 200
  i[#fontObj] = #none
  i[#hiColor] = gMenuHiColour
  i[#layer] = gMenuLayer
  i[#location] = point(10, 10)
  i[#margin] = 2
  i[#minWidth] = 30
  i[#minHeight] = 30
  i[#myController] = #none
  i[#pulse] = gMenuPulse
  i[#requester] = #none
  i[#shadowedColor] = gMenuShadowedColour
  i[#textLayer] = gMenuTextLayer
  i[#tileSet] = #none
  i[#titleDividerRow] = 3
  me.addModule("modFader")
  return me
end

on init me, params
  ancestor.init(params)
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
  pPulse = params.pulse
  pShadowedColor = params.shadowedColor
  pTextLayer = params.textLayer
  pTileSet = params.tileSet
  pTitleDividerRow = params.titleDividerRow
  pButtons = []
  pEditFields = []
  pEditFieldColumn = #none
  pMenuController = g.controllerMaster.getController(#menu)
  pTileMap = #none
  pTitle = #none
  pTitleMember = #none
  pTitleSprite = g.spriteMaster.requestSprite()
  pSpr = g.spriteMaster.requestSprite()
  pTitleSprite.locZ = pTextLayer
  pSpr.locZ = player
end

on finish me
  if pTileSet <> #none then
    pTileSet.finish()
    pTileSet = #none
  end if
  if pImageMember <> #none then
    g.memberMaster.freeMember(pImageMember)
    pImageMember = #none
  end if
  if pTitle <> #none then
    pTitle.finish()
    pTitle = #none
  end if
  if pTitleMember <> #none then
    g.memberMaster.freeMember(pTitleMember)
    pTitleMember = #none
  end if
  if pTitleSprite <> #none then
    g.spriteMaster.freeSprite(pTitleSprite)
    pTitleSprite = #none
  end if
  g.objectMaster.finishObjects(pButtons)
  pButtons = []
  g.objectMaster.finishObjects(pEditFields)
  pEditFields = []
  if pSpr <> #none then
    g.spriteMaster.freeSprite(pSpr)
    pSpr = #none
  end if
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
      #game:
        case theComm of
          #startGame:
            g.titlemaster.startGame()
          #viewInstructions:
            g.titlemaster.viewInstructions()
          #viewIntro:
            g.titlemaster.viewIntro()
        end case
      #Load_a_Map:
        g.mapEditMaster.loadMap(theComm)
      #start_menu:
        case theComm of
          #load:
            g.mapEditMaster.loadClicked(me)
        end case
      otherwise:
        if pAutoClose then
          me.finish()
        end if
        pRequester.menuOptionSelected(theComm, pDefinition.sym)
    end case
  end if
end

on calcMenuHeight me
  menHeight = pMinHeight
  def = pDefinition
  itms = def.items
  titleLines = 2
  if def.sym = #none then
    titleLines = 0
  end if
  lineSpacing = pTileSet.getTileSize()[2]
  linesRequired = itms.count
  linesRequired = linesRequired + titleLines
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
  if def.sym <> #none then
    if def.titleImage.width > pMinWidth then
      menWidth = def.titleImage.width
    end if
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
  me.startFadeIn()
end

on displayInSprite me, myImage
  pImageMember = g.memberMaster.requestMember(#bitmap, "menu")
  pImageMember.image = myImage
  pImageMember.regPoint = point(0, 0)
  SpriteSetMember(pSpr, pImageMember)
  pSpr.loc = pLocation
end

on displayTitleImage me
  if pDefinition.sym = #none then
    return 
  end if
  titleText = pDefinition.title
  titleImage = pDefinition.titleImage
  titleLoc = pLocation + (pTileSet.getTileSize() * point(pMargin, 1))
  pTitle = g.objectMaster.requestObject(#objMenuTitle)
  params = pTitle.getParams(#init)
  params.colour = pBaseColor.duplicate()
  pTitle.init(params)
  pTitle.displayImageAtLoc(titleImage, titleLoc)
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

on getSprite me
  return pSpr
end

on initTileMap me
  thewidth = me.big.calcMenuWidth()
  theheight = me.big.calcMenuHeight()
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
    itemDef = me.interpretItemDefinition(nLine)
    def.items.append(itemDef)
  end repeat
  pDefinition = def
  if def.sym = #none then
    pTitleDividerRow = 0
    pContentStartRow = 2
  end if
end

on interpretDivider me, nLine, menItem
  divPos = StringGetPos(nLine, "|")
  divType = #option
  if divPos = 0 then
    divPos = StringGetPos(nLine, ">")
    if divPos > 0 then
      divType = #editField
    end if
  end if
  menItem.type = divType
  return divPos
end

on interpretItemDefinition me, nLine
  menItem = g.structMaster.getStruct(#menuItem)
  dividerPos = me.interpretDivider(nLine, menItem)
  menItem.displayText = nLine.char[1..dividerPos - 2]
  commAndShadowed = nLine.char[dividerPos + 2..99]
  menItem.comm = value(commAndShadowed.word[1])
  shadowedPrg = value(commAndShadowed.word[2])
  shadowed = 0
  if shadowedPrg <> 0 then
    shadowed = g[shadowedPrg].isMenuItemShadowed(menItem.comm)
  end if
  menItem.shadowed = shadowed
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

on setAutoClose me, newVal
  pAutoClose = newVal
end

on setRequester me, newVal
  pRequester = newVal
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

on startFadeIn me
  pSpr.blend = 0
  me.startQuickFadeIn()
  if pTitle <> #none then
    pTitle.startFadeIn()
  end if
  call(#startFadeIn, pButtons)
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
    params.pulse = pPulse
    params.shadowedColor = pShadowedColor
    params.shadowed = itm.shadowed
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
