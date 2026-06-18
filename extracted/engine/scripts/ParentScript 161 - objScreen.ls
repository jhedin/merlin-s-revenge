property p, pCaller, pObjectsIStarted, pPrgsIStarted, ancestor
global g, gFrameNum, gStageSize

on new me
  me.ancestor = new(script("objBasic"))
  return me
end

on init me, sym, masterPrg
  p = [:]
  p[#struct] = [:]
  p.struct[#mark] = [#member: #none, #loc: point(0, 0), #draw: 1, #blend: 100]
  p[#marks] = []
  p[#masterPrg] = #none
  p[#sym] = #none
  me.setMasterPrg(masterPrg)
  me.setSymbol(sym)
  p[#buttons] = []
  p[#currentTransition] = #none
  p[#objectKey] = [#map: "dd_map_", #menu: "dd_menu_", #menuBackground: "dd_menuBackground_", #playMusic: "dd_playMusic", #PlaySound: "dd_playSound_"]
  p[#onscreen] = 0
  p[#sprites] = []
  p[#spritesInTransition] = 0
  pCaller = #none
  pObjectsIStarted = []
  pPrgsIStarted = []
end

on finish me
  if p.onscreen then
    me.spritesOff()
  end if
end

on offscreen me, transition, callback
  bDone = 0
  if p.onscreen = 0 then
    bDone = 1
  else
    case transition of
      #blast:
        me.blastOff()
        p.currentTransition = #off
      #flick:
        me.spritesOff()
        bDone = 1
      #fade, #slowfade:
        me.fadeOff()
        p.currentTransition = #off
      #fly:
        me.flyOff()
        p.currentTransition = #off
      #overlay:
        me.fadeDown()
    end case
    me.deactivateScreen()
  end if
  call(callback, p.masterPrg, bDone)
end

on onscreen me, transition, callback, caller
  pCaller = caller
  bDone = 0
  if p.onscreen = 1 then
    bDone = 1
  else
    case transition of
      #flick:
        me.flickOn()
        bDone = 1
      #blast, #fade, #fly, #overlay:
        me.fadeOn()
      #slowfade:
        me.fadeOnSlow()
    end case
    p.currentTransition = #on
  end if
  call(callback, p.masterPrg, bDone)
end

on setMarks me, marks
  if ilk(marks) = #list then
    p.marks = marks.duplicate()
  else
    put "objScreen.setMarks: marks not a list"
  end if
end

on setMasterPrg me, masterPrg
  if ilk(masterPrg) = #instance then
    p.masterPrg = masterPrg
  else
    il = ilk(masterPrg)
    put "objScreen.setMasterPrg: masterPrg not an instance it's a " & il
  end if
end

on setSymbol me, sym
  if ilk(sym) = #symbol then
    p.sym = sym
  else
    put "objScreen.setSymbol: symbol not a symbol"
  end if
end

on transBlendFin me
  me.spriteTransitionFin()
end

on moveXYFin me
  me.spriteTransitionFin()
end

on spriteTransitionFin me
  p.spritesInTransition = p.spritesInTransition - 1
  if p.spritesInTransition = 0 then
    case p.currentTransition of
      #off:
        me.spritesOff()
      #on:
        me.activateScreen()
    end case
    p.masterPrg.screenFinished()
  end if
end

on activateButtons me
  repeat with i = 1 to p.buttons.count
    nButt = p.buttons[i]
    nButt.activate()
  end repeat
end

on activateScreen me
  me.activateButtons()
  me.startPrgs()
  me.startObjects()
end

on blastOff me
  screenCentre = gStageSize / 2
  blastCentre = (the mouseLoc).duplicate()
  repeat with spr in p.sprites
    slope = SpriteGetLocOfMiddle(spr) - blastCentre
    slopeDir = PointDir(slope)
    slopePositive = PointPositive(slope.duplicate())
    PointReverse(slopePositive)
    blast = screenCentre - slopePositive
    blast = blast * slopeDir
    blast = blast / 7.0
    nMoveXY = g.objectMaster.requestObject(#objMoveXY)
    params = nMoveXY.getParams(#init)
    params.callingPrg = me
    params.spr = spr
    nMoveXY.init(params)
    nMoveXY.setVect(blast)
    nMoveXY.setGravity(0)
    nMoveXY.setWeight(5)
  end repeat
  p.spritesInTransition = p.sprites.count
end

on deactivateScreen me
  me.freeButtons()
  call(#finish, pObjectsIStarted)
  call(#finish, pPrgsIStarted)
  pObjectsIStarted = []
  pPrgsIStarted = []
end

on fadeDown me
  repeat with spr in p.sprites
    nTransBlend = g.objectMaster.requestObject(#objTransBlend)
    params = nTransBlend.getParams(#init)
    params.callingPrg = me
    params.spr = spr
    nTransBlend.init(params)
    nTransBlend.setAutoUpdate(1)
    nTransBlend.setTarget(spr.blend / 2)
  end repeat
  p.spritesInTransition = p.sprites.count
end

on fadeOn me
  me.spritesOn(0)
  i = 1
  repeat with spr in p.sprites
    nTransBlend = g.objectMaster.requestObject(#objTransBlend)
    params = nTransBlend.getParams(#init)
    params.callingPrg = me.id.bigMe
    params.spr = spr
    nTransBlend.init(params)
    nTransBlend.setAutoUpdate(1)
    repeat while p.marks[i].draw = 0
      i = i + 1
    end repeat
    nTransBlend.setTarget(p.marks[i].blend)
    i = i + 1
  end repeat
  p.spritesInTransition = p.sprites.count
end

on fadeOnSlow me
  me.spritesOn(0)
  repeat with spr in p.sprites
    nTransBlend = g.objectMaster.requestObject(#objTransBlend)
    params = nTransBlend.getParams(#init)
    params.callingPrg = me
    params.spr = spr
    nTransBlend.init(params)
    nTransBlend.setAutoUpdate(1)
    nTransBlend.setTarget(100)
    nTransBlend.setSpeed(1)
  end repeat
  p.spritesInTransition = p.sprites.count
end

on fadeOff me
  repeat with spr in p.sprites
    nTransBlend = g.objectMaster.requestObject(#objTransBlend)
    params = nTransBlend.getParams(#init)
    params.callingPrg = me
    params.spr = spr
    nTransBlend.init(params)
    nTransBlend.setAutoUpdate(1)
    nTransBlend.setTarget(0)
  end repeat
  p.spritesInTransition = p.sprites.count
end

on flickOn me
  me.spritesOn(#mark)
  p.spritesInTransition = 0
  me.activateScreen()
end

on flyOff me
  repeat with spr in p.sprites
    nMoveXY = g.objectMaster.requestObject(#objMoveXY)
    nMoveXY.init(me, spr)
    nX = VarRndRange(-50, 50)
    nY = VarRndRange(-50, 50)
    nMoveXY.setVect(point(nX, nY))
  end repeat
  p.spritesInTransition = p.sprites.count
end

on freeButtons me
  repeat with objButt in p.buttons
    objButt.finish()
  end repeat
  p.buttons = []
end

on getPosInObjectKey me, nName
  pos = 1
  repeat with nObjKey in p.objectKey
    if nName contains nObjKey then
      return pos
    end if
    pos = pos + 1
  end repeat
  return 0
end

on initButt me, spr
  buttCaller = pCaller
  if buttCaller = VOID then
    buttCaller = g.titlemaster
  end if
  newButt = g.objectMaster.requestObject(#objButton)
  params = newButt.getParams(#init)
  params.callingPrg = buttCaller
  params.spr = spr
  newButt.init(params)
  p.buttons.append(newButt)
end

on spritesOff me
  me.freeButtons()
  repeat with spr in p.sprites
    g.spriteMaster.freeSprite(spr.spriteNum)
  end repeat
  p.sprites = []
  p.onscreen = 0
end

on spritesOn me, blend
  repeat with i = 1 to p.marks.count
    nMark = p.marks[i]
    if nMark.draw then
      if blend = #mark then
        nBlend = nMark.blend
      else
        nBlend = blend
      end if
      spr = g.spriteMaster.requestSprite()
      p.sprites.append(spr)
      spr.member = nMark.member
      spr.loc = nMark.loc.duplicate()
      spr.blend = nBlend
      spr.ink = nMark.ink
      spr.flipH = nMark.flipH
      spr.flipV = nMark.flipV
      spr.width = nMark.width
      spr.height = nMark.height
      spr.color = nMark.color
      spr.bgColor = nMark.bgColor
      if nMark.member.name contains "butt" then
        me.initButt(spr)
      end if
      if nMark.member.name contains "locz" then
        layerZ = MemberExtractLocZ(nMark.member)
        spr.locZ = layerZ
      end if
    end if
  end repeat
  p.onscreen = 1
end

on finishObjects me
end

on finishPrgs me
end

on startObjects me
  pObjectsIStarted = []
  repeat with nMark in p.marks
    nName = nMark.member.name
    pos = me.getPosInObjectKey(nName)
    if pos > 0 then
      nType = p.objectKey.getPropAt(pos)
      nLocation = nMark.loc
      if pCaller = VOID then
        requestor = g.gamemaster
      else
        requestor = pCaller
      end if
      obj = g.controllerMaster.newObject(nType, nMark.member, nLocation, requestor)
      pObjectsIStarted.append(obj)
    end if
  end repeat
end

on startPrgs me
  pPrgsIStarted = []
  repeat with i = 1 to p.marks.count
    nMark = p.marks[i]
    nName = nMark.member.name
    if nName contains "prg" then
      prgName = chars(nName, 5, 99)
      prgSym = symbol(prgName)
      g[prgSym].start(nMark.loc, nMark)
      pPrgsIStarted.append(g[prgSym])
    end if
  end repeat
end
