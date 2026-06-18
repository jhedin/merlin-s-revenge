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
  s[#collisionAxesToUse] = me.structCollisionAxesToUse()
  s[#collisionEdge] = me.structCollisionEdge()
  s[#corners] = me.structCorners()
  s[#dirFour] = me.structDirFour()
  s[#eventNotify] = me.structEventNotify()
  s[#exitArrowsStatusProgression] = me.structExitArrowsStatusProgression()
  s[#graveRecord] = me.structGraveRecord()
  s[#GridSelectorBoxes] = me.structGridSelectorBoxes()
  s[#linePackage] = me.structLinePackage()
  s[#mapDefinition] = me.structMapDefinition()
  s[#mapTileSets] = me.structMapTileSets()
  s[#menuDefinition] = me.structMenuDefinition()
  s[#menuItem] = me.structMenuItem()
  s[#miniMapStatusProgression] = me.structMiniMapStatusProgression()
  s[#objectNotification] = me.structObjectNotification()
  s[#page] = me.structPage()
  s[#playSoundArgs] = me.structPlaySoundArgs()
  s[#plotScript] = me.structPlotScript()
  s[#potionRecord] = me.structPotionRecord()
  s[#rectInfo] = me.structRectInfo()
  s[#reservation] = me.structReservation()
  s[#roomTileSets] = me.structRoomTileSets()
  s[#row] = me.structRow()
  s[#screenCall] = me.structScreenCall()
  s[#screenExits] = me.structScreenExits()
  s[#scriptLine] = me.structScriptLine()
  s[#scriptPlayer] = me.structScriptPlayer()
  s[#spellPayload] = me.structSpellPayload()
  s[#surroundingTiles] = me.structSurroundingTiles()
  s[#targetDetails] = me.structTargetDetails()
  s[#teamCategories] = me.structTeamCategories()
  s[#teamClosestInfo] = me.structTeamClosestInfo()
  s[#teamData] = me.structTeamData()
  s[#teamTarget] = me.structTeamTarget()
  s[#tileSetDefinition] = me.structTileSetDefinition()
  s[#timerProfile] = me.structTimerProfile()
  s[#toolPaletteGridSelectors] = me.structToolPaletteGridSelectors()
  s[#walkScrollArgs] = me.structWalkScrollArgs()
  s[#weaponSelectorPaletteOffsets] = me.structWeaponSelectorPaletteOffsets()
  s[#weaponSelectorPaletteTypes] = me.structWeaponSelectorPaletteTypes()
  s[#exitArrowMembers] = me.structExitArrowMembers()
end

on structAttack me
  a = [:]
  a[#animframe] = 2
  a[#animType] = #none
  a[#beam] = 0
  a[#bullet] = #none
  a[#chargeColour] = rgb(255, 255, 255)
  a[#chargeExplodeFactor] = 4
  a[#chargePerUnit] = 5
  a[#chargeMax] = 5
  a[#chargeMaxBasic] = 0
  a[#chargeMaxModifier] = 1
  a[#chargeSize] = 1
  a[#chargeSpeed] = 1
  a[#chargeSpeedMax] = #unlimited
  a[#chargeStart] = 1
  a[#chargeStartMax] = #none
  a[#chargeVolumeMap] = [#charge: [1, 100], #vol: [10, 255]]
  a[#collisionLoc] = point(25, 0)
  a[#idealAttackLoc] = #collisionLoc
  a[#cooldown] = 0
  a[#cutHair] = 0
  a[#damageMultiplier] = 1
  a[#explodeCharge] = 10
  a[#explodeFunction] = #none
  a[#explodeSound] = #none
  a[#fireDelay] = 2
  a[#firingType] = #proportional
  a[#freezeMultiplier] = 1
  a[#hits] = [#teamMembers]
  a[#limitMagic] = 0
  a[#multistage] = #none
  a[#name] = #none
  a[#payLoadFunction] = [#takeHit]
  a[#payloadFunctionNonBlank] = [#same]
  a[#power] = point(5, -1)
  a[#reach] = 25
  a[#releaseFunction] = #release
  a[#releaseSound] = #none
  a[#residentTeamCategory] = #none
  a[#spellSpeed] = 2
  a[#sound] = #none
  a[#targetAllegiance] = #enemy
  a[#targetCriteria] = #closestDistance
  a[#targetRoles] = [[#teamMembers, #teamBuildings]]
  a[#targetTileWhenNotBlank] = 0
  a[#type] = #auto
  a[#volume] = 150
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

on structCollisionAxesToUse me
  c = [:]
  c[#objectAxis] = #none
  c[#objectRectSide] = #none
  c[#playAreaSide] = #none
  c[#zoneRectSide] = #none
  return c
end

on structCollisionEdge me
  c = [:]
  c[#location] = 0
  c[#axis] = 1
  c[#solid] = 0
  return c
end

on structCorners me
  c = [:]
  c[#topLeft] = 0
  c[#topRight] = 0
  c[#bottomRight] = 0
  c[#bottomLeft] = 0
  return c
end

on structDirFour me
  d = [:]
  d[#left] = point(-1, 0)
  d[#up] = point(0, -1)
  d[#right] = point(1, 0)
  d[#down] = point(0, 1)
  return d
end

on structEventNotify me
  e = [:]
  e[#obj] = #none
  e[#frequency] = #once
  return e
end

on structExitArrowMembers me
  e = [:]
  grn = g.structMaster.getStruct(#screenExits)
  rdd = g.structMaster.getStruct(#screenExits)
  grn.left = member("arrow_green_left", "gfx")
  grn.top = member("arrow_green_up", "gfx")
  grn.right = member("arrow_green_right", "gfx")
  grn.bottom = member("arrow_green_down", "gfx")
  rdd.left = member("arrow_red_left", "gfx")
  rdd.top = member("arrow_red_up", "gfx")
  rdd.right = member("arrow_red_right", "gfx")
  rdd.bottom = member("arrow_red_down", "gfx")
  arrMem = e
  arrMem[#grn] = grn
  arrMem[#rdd] = rdd
  return e
end

on structExitArrowsStatusProgression me
  e = [#clr, #inf]
  return e
end

on structGraveRecord me
  gr = [:]
  gr[#actorType] = #none
  gr[#member] = #none
  gr[#rect] = #none
  return gr
end

on structGridSelectorBoxes me
  gr = [:]
  gr[#green] = #none
  gr[#yellow] = #none
  return gr
end

on structLinePackage me
  l = [:]
  l[#args] = #none
  l[#caller] = #none
  l[#delayTime] = 0
  l[#displayTime] = 0
  l[#obj] = #none
  l[#objCharacter] = #none
  l[#theCommand] = #none
  return l
end

on structMapDefinition me
  m = [:]
  m[#map] = [:]
  ma = m.map
  ma[#mapSize] = #none
  ma[#roomSize] = #none
  ma[#startRoom] = point(1, 1)
  ma[#roomMapScale] = 1 / 8
  ma[#roomEditScale] = 1
  ma[#roomPlayScale] = 1
  ma[#layerDefinitions] = []
  ma[#rooms] = []
  return m
end

on structMapTileSets me
  m = [:]
  m[#backgroundPassive] = #none
  m[#backgroundActive] = #none
  m[#actors] = #none
  m[#foregroundPassive] = #none
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
  m[#shadowed] = #none
  m[#type] = #option
  return m
end

on structMiniMapStatusProgression me
  return [#clr, #inf, #fre, #spe]
end

on structObjectNotification me
  o = [:]
  o[#callingPrg] = #none
  o[#functionToCall] = #none
  o[#event] = #finish
  o[#objectFlag] = #objEnemyCharacter
  return o
end

on structPage me
  p = [:]
  p[#endRow] = #none
  p[#startRow] = #none
  return p
end

on structPlaySoundArgs me
  p = [:]
  p[#memberToPlay] = #none
  p[#volumeLevel] = 255
  return p
end

on structPlotScript me
  p = [:]
  p[#players] = []
  p[#theLines] = []
  return p
end

on structPotionRecord me
  p = [:]
  p[#character] = #none
  p[#colour] = rgb(255, 255, 255)
  p[#counter] = #none
  p[#icon] = #none
  p[#member] = #none
  p[#numCollected] = 0
  return p
end

on structRectInfo me
  r = [:]
  r[#rect] = rect(0, 0, 0, 0)
  r[#edgeOffset] = rect(0, 0, 0, 0)
  return r
end

on structReservation me
  r = [:]
  r[#obj] = #none
  r[#num] = #none
  r[#typ] = #enemies
  return r
end

on structRoomTileSets me
  r = me.structMapTileSets()
  return r
end

on structRow me
  r = [:]
  r[#floor] = 0
  r[#endUnit] = #none
  r[#startUnit] = #none
  return r
end

on structScreenCall me
  s = [:]
  s[#sym] = #none
  s[#caller] = #none
  return s
end

on structScreenExits me
  s = [:]
  s[#left] = []
  s[#top] = []
  s[#right] = []
  s[#bottom] = []
  return s
end

on structScriptLine me
  s = [:]
  s[#args] = []
  s[#objCharacter] = #none
  s[#theCommand] = #none
  return s
end

on structScriptPlayer me
  s = [:]
  s[#createdForScript] = 0
  s[#obj] = #none
  s[#objCharacter] = #none
  s[#scriptname] = #none
  return s
end

on structSpellPayload me
  s = [:]
  s[#chargeRequired] = 999
  s[#payload] = #none
  return s
end

on structSurroundingTiles me
  s = [:]
  s[#left] = #none
  s[#top] = #none
  s[#right] = #none
  s[#bottom] = #none
  return s
end

on structTargetDetails me
  t = [:]
  t[#team] = #none
  t[#teamRole] = #none
  t[#sprloc] = #none
  return t
end

on structTeamCategories me
  t = [:]
  t[#enemies] = 0
  t[#friends] = 0
  t[#neutrals] = 0
  return t
end

on structTeamClosestInfo me
  t = [:]
  t[#closestPos] = #none
  t[#furthestPos] = #none
  t[#closestList] = []
  return t
end

on structTeamData me
  t = [:]
  t[#teamName] = #none
  t[#category] = #enemies
  t[#colour] = rgb(200, 200, 200)
  t[#hates] = [#all]
  t[#immuneToAttack] = 0
  t[#maxMembers] = 5
  t[#teamBuildings] = []
  t[#teamBullets] = []
  t[#teamMembers] = []
  t[#teamMines] = []
  return t
end

on structTeamTarget me
  t = [:]
  t[#obj] = #none
  t[#dist] = 999999
  t[#priorityRank] = 999
  return t
end

on structTileSetDefinition me
  t = [:]
  t[#tilesize] = point(16, 16)
  t[#theKey] = []
  return t
end

on structTimerProfile me
  t = [:]
  t[#stTime] = 0
  t[#finTime] = 0
  t[#totalTime] = 0
  return t
end

on structToolPaletteGridSelectors me
  t = [:]
  t[#map] = #none
  t[#room] = #none
  t[#tileSet] = #none
  return t
end

on structWalkScrollArgs me
  w = [:]
  w[#Dir] = #left
  w[#speed] = 3
  w[#characters] = []
  return w
end

on structWeaponSelectorPaletteOffsets me
  w = [:]
  w[#magic] = -20
  w[#nonMagic] = 10
  return w
end

on structWeaponSelectorPaletteTypes me
  w = [#magic, #nonMagic]
  return w
end

on getStruct me, which
  return pStructs[which].duplicate()
end

on stop me
end
