property pStructs
global g

on new me
  return me
end

on init me
  pStructs = [:]
  s = pStructs
  s[#attack] = me.structAttack()
  s[#blankRoom] = me.structBlankRoom()
  s[#blankRoomLayer] = me.structBlankRoomLayer()
  s[#boxSprites] = me.structBoxSprites()
  s[#GridSelectorBoxes] = me.structGridSelectorBoxes()
  s[#mapDefinition] = me.structMapDefinition()
  s[#mapTileSets] = me.structMapTileSets()
  s[#menuDefinition] = me.structMenuDefinition()
  s[#menuItem] = me.structMenuItem()
  s[#roomTileSets] = me.structRoomTileSets()
  s[#structTileSetsPassive] = me.structTileSetsPassive()
  s[#structTileSetsActive] = me.structTileSetsActive()
  s[#structTileSetsObjects] = me.structTileSetsObjects()
  s[#tileSetDefinition] = me.structTileSetDefinition()
  s[#toolPaletteGridSelectors] = me.structToolPaletteGridSelectors()
end

on structAttack me
  a = [:]
  a[#animframe] = 2
  a[#bullet] = #none
  a[#collisionLoc] = point(25, 0)
  a[#idealAttackLoc] = point(25, 0)
  a[#cooldown] = 0
  a[#cutHair] = 0
  a[#power] = point(5, -1)
  a[#reach] = point(25, 0)
  a[#type] = #melee
  return a
end

on structBlankRoom me
  b = [:]
  b[#num] = 0
  b[#layerDefinitions] = #none
  b[#layers] = []
  return b
end

on structBlankRoomLayer me
  b = [:]
  b[#name] = #none
  b[#map] = #none
  b[#mapSize] = #none
  return b
end

on structBoxSprites me
  b = [:]
  b[#top] = #none
  b[#bottom] = #none
  b[#left] = #none
  b[#right] = #none
  return b
end

on structGridSelectorBoxes me
  gr = [:]
  gr[#green] = #none
  gr[#yellow] = #none
  return gr
end

on structMapDefinition me
  m = [:]
  m[#map] = [:]
  ma = m.map
  ma[#mapSize] = #none
  ma[#roomSize] = #none
  ma[#startRoom] = point(1, 1)
  ma[#endRoom] = #none
  ma[#refreshRoomMapImage] = 1
  ma[#roomMapScale] = 1 / 8
  ma[#roomEditScale] = 1
  ma[#roomPlayScale] = 1
  ma[#layerDefinitions] = []
  ma[#rooms] = []
  return m
end

on structTileSetsPassive me
  m = [#merlinPassive, #rapunzelPassive, #merlin4Passive, #merlinOpenPassive, #tiltPassive, #tiltPassiveTwo]
  return m
end

on structTileSetsActive me
  m = [#merlinActive, #rapunzelActive, #merlin4Active, #merlinOpenActive]
  return m
end

on structTileSetsObjects me
  m = [#merlinObjects, #rapunzelObjects, #merlin4Objects, #merlinOpenObjects]
  return m
end

on structMapTileSets me
  m = [:]
  m[#backgroundPassive] = #none
  m[#backgroundActive] = #none
  m[#actors] = #none
  m[#foregroundPassive] = #none
  m[#objects] = #none
  return m
end

on structMenuDefinition me
  m = [:]
  m[#title] = "new menu"
  m[#titleImage] = #none
  m[#sym] = #new_menu
  m[#items] = []
  return m
end

on structMenuItem me
  m = [:]
  m[#displayText] = "Item"
  m[#displayImage] = #none
  m[#comm] = #menuClicked
  m[#type] = #option
  return m
end

on structRoomTileSets me
  r = me.structMapTileSets()
  return r
end

on structTileSetDefinition me
  t = [:]
  t[#tilesize] = point(16, 16)
  t[#displayScale] = 1
  t[#theKey] = [:]
  return t
end

on structToolPaletteGridSelectors me
  s = [:]
  s[#map] = #none
  s[#room] = #none
  s[#tileSet] = #none
  return s
end

on getStruct me, which
  return pStructs[which].duplicate()
end

on stop me
end
