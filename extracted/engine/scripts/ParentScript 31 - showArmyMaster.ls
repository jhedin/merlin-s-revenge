property pDisplayRect, pPageNum, pPages, pRows, pUnitDisplayers, pXGap, pYGap
global g

on new me
  return me
end

on init me
  pDisplayRect = #none
  pPages = []
  pPageNum = 1
  pRows = []
  pXGap = 4
  pYGap = 8
  pUnitDisplayers = []
end

on finish me
  me.finishUnitDisplayers()
  pPages = []
  pRows = []
end

on finishUnitDisplayers me
  if (ilk(pUnitDisplayers) <> #void) and (pUnitDisplayers <> []) then
    repeat with unitDisp in pUnitDisplayers
      unitDisp.finish()
    end repeat
    pUnitDisplayers = []
  end if
end

on changePage me, theOption
  case theOption of
    #nextPage:
      pPageNum = pPageNum + 1
    #previousPage:
      pPageNum = pPageNum - 1
  end case
end

on displayReserveArmy me, armies
  me.finishUnitDisplayers()
  teamToDisplay = g.armyMaster.getTeamToDisplay()
  army = armies[teamToDisplay]
  me.setupDisplay(army)
  if pPageNum > pPages.count then
    pPageNum = 1
  end if
  me.displayPage(pPageNum)
end

on displayPage me, pageNum
  currentPage = pPages[pageNum]
  rowNum = currentPage.startRow
  repeat while me.isPageFinished(currentPage, rowNum) = 0
    if pRows.count < rowNum then
      exit repeat
    end if
    me.displayRow(rowNum)
    rowNum = rowNum + 1
  end repeat
end

on displayRow me, rowNum
  currentRow = pRows[rowNum]
  unitNum = currentRow.startUnit
  xLoc = pDisplayRect.left
  repeat while me.isRowFinished(currentRow, unitNum) = 0
    if pUnitDisplayers.count < unitNum then
      exit repeat
    end if
    xLoc = me.displayUnit(unitNum, xLoc, currentRow.floor)
    unitNum = unitNum + 1
  end repeat
end

on displayUnit me, unitNum, xLoc, floorLoc
  unit = pUnitDisplayers[unitNum]
  boundingRect = unit.getBoundingRect()
  unit.displayUnit(point(xLoc, floorLoc))
  xLoc = xLoc + boundingRect.width + pXGap
  return xLoc
end

on displayUnits me
  rowNum = 1
  unitNum = 1
  currentRow = pRows[rowNum]
  xLoc = pDisplayRect.left
  repeat with unit in pUnitDisplayers
    if me.checkEndOfRow(currentRow, unitNum) then
      rowNum = rowNum + 1
      currentRow = pRows[rowNum]
      xLoc = pDisplayRect.left
    end if
    boundingRect = unit.getBoundingRect()
    unit.displayUnit(point(xLoc, currentRow.floor))
    xLoc = xLoc + boundingRect.width + pXGap
    unitNum = unitNum + 1
  end repeat
end

on isMenuItemShadowed me, theComm
  shadowed = 1
  if pPageNum > pPages.count then
    pPageNum = 1
  end if
  case theComm of
    #nextPage:
      if pPageNum < pPages.count then
        shadowed = 0
      end if
    #previousPage:
      if pPageNum > 1 then
        shadowed = 0
      end if
  end case
  return shadowed
end

on isPageFinished me, thePage, rowNum
  if thePage.endRow = #none then
    return 0
  end if
  if thePage.endRow <= rowNum then
    return 1
  end if
  return 0
end

on isRowFinished me, currentRow, unitNum
  rEnd = currentRow.endUnit
  if rEnd = #none then
    return 0
  end if
  if rEnd <= unitNum then
    return 1
  end if
  return 0
end

on newPage me, rowNum
  newPage = g.structMaster.getStruct(#page)
  newPage.startRow = rowNum
  pPages.append(newPage)
  return newPage
end

on newRow me, unitNum
  newRow = g.structMaster.getStruct(#row)
  newRow.startUnit = unitNum
  newRow.floor = pDisplayRect.top
  pRows.append(newRow)
  return newRow
end

on newUnitDisplayer me
  unitDisplayer = g.objectMaster.requestObject(#objUnitDisplayer)
  params = unitDisplayer.getParams(#init)
  unitDisplayer.init(params)
  return unitDisplayer
end

on menuOptionSelected me, theOption, theMenu
  g.screenMaster.screenOff(#showArmy)
  case theOption of
    #backToGameMenu:
      g.screenMaster.screenOn(#ingameMenu, g.gamemaster)
    #nextPage, #previousPage:
      g.showArmyMaster.changePage(theOption)
      g.screenMaster.screenOn(#showArmy, me)
    #resumeGame:
      g.gamemaster.menuOptionSelected(theOption, theMenu)
  end case
end

on setupDisplay me, army
  xLoc = pDisplayRect.left
  yLoc = pDisplayRect.top
  unitNum = 1
  rowNum = 1
  currentRow = me.newRow(unitNum)
  currentPage = me.newPage(rowNum)
  repeat with unitList in army
    repeat with unit in unitList
      unitDisplayer = me.newUnitDisplayer()
      boundingRect = unitDisplayer.calcBoundingRect(unit, point(xLoc, yLoc))
      if boundingRect.right > pDisplayRect.right then
        currentRow.endUnit = unitNum
        yLoc = currentRow.floor + pYGap
        xLoc = pDisplayRect.left
        currentRow = me.newRow(unitNum)
        currentRow.floor = yLoc
        rowNum = rowNum + 1
        boundingRect = unitDisplayer.calcBoundingRect(unit, point(xLoc, yLoc))
      end if
      if boundingRect.bottom > currentRow.floor then
        currentRow.floor = boundingRect.bottom
      end if
      if currentRow.floor > pDisplayRect.bottom then
        currentPage.endRow = rowNum
        floorDistance = currentRow.floor - yLoc
        yLoc = pDisplayRect.top
        currentPage = me.newPage(rowNum)
        boundingRect = unitDisplayer.calcBoundingRect(unit, point(xLoc, yLoc))
        currentRow.floor = yLoc + floorDistance
      end if
      pUnitDisplayers.append(unitDisplayer)
      xLoc = xLoc + boundingRect.width + pXGap
      unitNum = unitNum + 1
    end repeat
  end repeat
end

on start me, theloc, theMark
  pDisplayRect = RectCalcFromMark(theMark)
  reserveArmy = g.armyMaster.getReserveArmy()
  me.displayReserveArmy(reserveArmy)
end

on stop me
  me.finish()
end
