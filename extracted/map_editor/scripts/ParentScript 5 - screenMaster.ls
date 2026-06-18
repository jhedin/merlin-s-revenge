property p
global g

on new me
  return me
end

on init me
  p = [:]
  p[#params] = [:]
  p.params[#goScreen] = [#screenSym: #none, #transition: #flick, #caller: #none]
  p[#dontDraw] = ["dd_", "prg_"]
  p[#mark] = [#member: #none, #loc: point(0, 0), #width: 0, #height: 0, #ink: 0, #blend: 0, #flipH: 0, #flipV: 0, #color: rgb(0, 0, 0), #bgColor: rgb(255, 0, 255), #draw: 1]
  p[#screenList] = [:]
  p[#currentTransition] = [:]
  ct = p.currentTransition
  ct[#caller] = #none
  ct[#stage] = #none
  ct[#targetScreenSym] = #none
  ct[#transition] = #none
  ct[#waitingForScreens] = 0
  me.initScreenList()
end

on getParams me, functionSym
  return p.params[functionSym]
end

on goScreen me, params
  me.startTransition(params.screenSym, params.transition, params.caller)
end

on stop me
end

on calcDraw me, memname
  repeat with dontName in p.dontDraw
    if memname contains dontName then
      return 0
    end if
  end repeat
  return 1
end

on initScreenList me
  g.spriteMaster.visibleAll(0)
  numLabels = (the labelList).lines.count - 1
  repeat with i = 1 to numLabels
    go(marker(1))
    screenSym = symbol(the frameLabel)
    nScreen = g.objectMaster.requestObject(#objScreen)
    nScreen.init(screenSym, me)
    nScreen.setMarks(me.getMarks())
    p.screenList[screenSym] = nScreen
  end repeat
  go(1)
  g.spriteMaster.visibleAll(1)
end

on getMarks me
  thelist = []
  repeat with i = 1 to the lastChannel
    if sprite(i).member <> member(0, 0) then
      nMark = me.newBlank(#mark)
      nMark.member = sprite(i).member
      nMark.loc = sprite(i).loc.duplicate()
      nMark.width = sprite(i).width
      nMark.height = sprite(i).height
      nMark.ink = sprite(i).ink
      nMark.blend = sprite(i).blend
      nMark.flipH = sprite(i).flipH
      nMark.flipV = sprite(i).flipV
      nMark.color = sprite(i).color
      nMark.bgColor = sprite(i).bgColor
      nMark.draw = me.calcDraw(nMark.member.name)
      thelist.append(nMark)
    end if
  end repeat
  return thelist
end

on newBlank me, sym
  return p[sym].duplicate()
end

on sendAllScreens me, function, transition
  ct = p.currentTransition
  ct.waitingForScreens = 0
  repeat with scr in p.screenList
    call(function, scr, transition, #screenResponseWaitForMe)
  end repeat
end

on screenFinished me
  ct = p.currentTransition
  ct.waitingForScreens = ct.waitingForScreens - 1
  if ct.waitingForScreens = 0 then
    case ct.stage of
      #start:
        me.continueTransition()
      #continue:
        me.finishTransition()
    end case
  end if
end

on screenResponseWaitForMe me, bDone
  ct = p.currentTransition
  if bDone = 0 then
    ct.waitingForScreens = ct.waitingForScreens + 1
  end if
end

on startTransition me, targetScreenSym, transition, caller
  ct = p.currentTransition
  ct.targetScreenSym = targetScreenSym
  ct.transition = transition
  ct.caller = caller
  ct.stage = #start
  me.sendAllScreens(#offscreen, ct.transition)
  if ct.waitingForScreens = 0 then
    me.continueTransition()
  end if
end

on continueTransition me
  ct = p.currentTransition
  targetScreen = p.screenList[ct.targetScreenSym]
  targetScreen.onscreen(ct.transition, #screenResponseWaitForMe)
  ct.stage = #continue
  if ct.waitingForScreens = 0 then
    me.finishTransition()
  end if
end

on finishTransition me
  ct = p.currentTransition
  ct.stage = #finish
  ct.caller.goScreenFinished()
end
