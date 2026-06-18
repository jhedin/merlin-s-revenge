property pCurrentMap, pFirstMenu, pLocation, pMapController, pMenuController
global g, r

on new me
  return me
end

on init me
  pCurrentMap = #none
  pFirstMenu = "start"
  pLocation = #none
  pMapController = g.controllerMaster.getController(#map)
  pMenuController = g.controllerMaster.getController(#menu)
end

on finish me
  me.finishCurrentMap()
end

on start me, location
  pLocation = location
  pMenuController.newObject(member("dd_menu_" & pFirstMenu, "gfx"), pLocation)
end

on finishCurrentMap me
  if (ilk(pCurrentMap) <> #void) and (pCurrentMap <> #none) then
    pCurrentMap.finish()
  end if
end

on loadClicked me, theMenu
  listOfMaps = me.getListOfMaps()
  location = theMenu.getNextLocation()
  pMenuController.newDialogue("Load a Map", listOfMaps, location)
end

on loadMap me, themap
  pMenuController.clearAll()
  theMapName = "dd_map_" & string(themap)
  me.finishCurrentMap()
  definition = member(theMapName, "gfx")
  pCurrentMap = pMapController.makeNewObject(definition, pLocation, theMapName)
  pCurrentMap.goEditMode()
  pCurrentMap.onscreen()
end

on getListOfMaps me
  nameList = []
  memList = CastGetMembersContaining("dd_map_", "gfx")
  repeat with mem in memList
    nName = mem.name.char[8..99]
    nameList.append(nName)
  end repeat
  return nameList
end

on stop me
  me.finish()
end
