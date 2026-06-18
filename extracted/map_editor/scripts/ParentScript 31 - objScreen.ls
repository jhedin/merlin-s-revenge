property p, ancestor
global g, gFrameNum, gStageSize

on new me
  me.ancestor = new(script("objBasic"))
  return me
end

on init me, sym, masterPrg
  p = [:]
  p[#struct] = [:]
  p.struct[#mark] = [#member: #none, #loc: point(0, 0), #draw: 1]
  p[#marks] = []
  p[#masterPrg] = #none
  p[#sym] = #none
  me.setMasterPrg(masterPrg)
  me.setSymbol(sym)
  p[#buttons] = []
  p[#currentTransition] = #none
  p[#objectKey] = [#map: "dd_map", #menu: "dd_menu"]
  p[#onscreen] = 0
  p[#sprites] = []
  p[#spritesInTransition] = 0
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
    me.freeButtons()
  end if
  call(callback, p.masterPrg, bDone)
end

on onscreen me, transition, callback
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

on transformFin me
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
    nMoveXY.init(me, spr)
    nMoveXY.setVect(blast)
    nMoveXY.setGravity(0)
    nMoveXY.setWeight(5)
  end repeat
  p.spritesInTransition = p.sprites.count
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
  repeat with spr in p.sprites
    nTransBlend = g.objectMaster.requestObject(#objTransBlend)
    params = nTransBlend.getParams(#init)
    params.callingPrg = me
    params.spr = spr
    nTransBlend.init(params)
    nTransBlend.setAutoUpdate(1)
    nTransBlend.setTarget(100)
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
  me.spritesOn(100)
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
  newButt = g.objectMaster.requestObject(#objButton)
  params = newButt.getParams(#init)
  params.callingPrg = g.titlemaster
  params.spr = spr
  newButt.init(params)
  p.buttons.append(newButt)
end

on spritesOff me
  me.freeButtons()
  repeat with spr in p.sprites
    g.spriteMaster.freeSprite(spr)
  end repeat
  p.sprites = []
  p.onscreen = 0
end

on spritesOn me, blend
  repeat with i = 1 to p.marks.count
    nMark = p.marks[i]
    if nMark.draw then
      spr = g.spriteMaster.requestSprite()
      p.sprites.append(spr)
      spr.member = nMark.member
      spr.loc = nMark.loc.duplicate()
      spr.blend = blend
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
    end if
  end repeat
  p.onscreen = 1
end

on startObjects me
  repeat with nMark in p.marks
    nName = nMark.member.name
    pos = me.getPosInObjectKey(nName)
    if pos > 0 then
      nType = p.objectKey.getPropAt(pos)
      nLocation = nMark.loc
      g.controllerMaster.newObject(nType, nMark.member, nLocation)
    end if
  end repeat
end

on startPrgs me
  repeat with i = 1 to p.marks.count
    nMark = p.marks[i]
    nName = nMark.member.name
    if nName contains "prg" then
      prgName = chars(nName, 5, 99)
      prgSym = symbol(prgName)
      g[prgSym].start(nMark.loc)
    end if
  end repeat
end
