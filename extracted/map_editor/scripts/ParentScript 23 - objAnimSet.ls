property ancestor, pStripInit, pStrips
global g

on new me
  me.ancestor = new(script("objBasic"))
  return me
end

on newStripInit me, name, delay
  stripInit = pStripInit.duplicate()
  stripInit.name = name
  if delay <> VOID then
    stripInit.delay = delay
  end if
  return stripInit
end

on init me, name, charType
  pStripInit = [#name: #none, #delay: 3]
  stripInits = me.getStripInits(charType)
  me.initAnimStrips(name, stripInits)
end

on initAnimStrips me, name, stripInits
  pStrips = [:]
  repeat with stripInit in stripInits
    nSymbol = symbol(stripInit.name)
    nName = name & "_" & stripInit.name
    nStrip = g.objectMaster.requestObject(#objAnimStrip)
    nStrip.init(nName)
    nStrip.setDelay(stripInit.delay)
    pStrips[nSymbol] = nStrip
  end repeat
end

on finish me
  repeat with strip in pStrips
    strip.finish()
  end repeat
  pStrips = [:]
  ancestor.finish()
end

on getFin me, sym
  return pStrips[sym].getFin()
end

on getFrame me, sym
  return pStrips[sym].getFrame()
end

on getFrameFresh me, sym
  return pStrips[sym].getFrameFresh()
end

on getLooped me, sym
  return pStrips[sym].getLooped()
end

on getMember me, sym
  return pStrips[sym].getMember()
end

on getStripInits me, charType
  stripInits = []
  case charType of
    #bullet:
      stripInits.append(me.newStripInit("stand"))
      stripInits.append(me.newStripInit("explode"))
    #character:
      stripInits.append(me.newStripInit("jump"))
      stripInits.append(me.newStripInit("stand"))
      stripInits.append(me.newStripInit("walk"))
    #enemyCharacter:
      stripInits = me.getStripInits(#character)
      stripInits.append(me.newStripInit("attack"))
      stripInits.append(me.newStripInit("reel_fly"))
      stripInits.append(me.newStripInit("reel_landed"))
    #flyingEnemyCharacter:
      stripInits.append(me.newStripInit("fly", 1))
      stripInits.append(me.newStripInit("glide"))
      stripInits.append(me.newStripInit("stand"))
      stripInits.append(me.newStripInit("attack"))
      stripInits.append(me.newStripInit("reel_fly"))
      stripInits.append(me.newStripInit("reel_landed"))
    #flyingRecoilEnemyCharacter:
      stripInits = me.getStripInits(#flyingEnemyCharacter)
      stripInits.append(me.newStripInit("recoil"))
    #playerCharacter:
      stripInits = me.getStripInits(#character)
      stripInits.append(me.newStripInit("die", 1))
    #weapon:
      stripInits.append(me.newStripInit("attack"))
      stripInits.append(me.newStripInit("carried"))
      stripInits.append(me.newStripInit("fall"))
  end case
  return stripInits
end

on resetAnim me, sym
  pStrips[sym].reset()
end
