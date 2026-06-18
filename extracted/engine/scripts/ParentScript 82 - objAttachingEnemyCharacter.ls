property ancestor, pAttachObj, pAttachCounter

on new me
  ancestor = new(script("objEnemyCharacter"))
  i = me.modifyParams(#init)
  i[#attachDuration] = 120
  return me
end

on init me, params
  ancestor.init(params)
  pAttachCounter = CounterNew()
  pAttachCounter.tim = [0, params.attachDuration]
end

on attachObjAttacked me
  objChar = pAttachObj.getCharacter()
  case objChar of
    #hair:
      pAttachObj.cutOff()
  end case
end

on attachTo me, attachObj
  pAttachObj = attachObj
  pAttachObj.registerParasite(me)
  me.goMode(#attach)
end

on loseEnergy me, amount
  ancestor.loseEnergy(amount)
  if me.pmode = #attach then
    me.goMode(#reelFly)
  end if
end

on checkCollisionsWithHair me
  case me.pmode of
    #attach:
      return 
  end case
  ancestor.checkCollisionsWithHair()
end

on getAnimSym me, sym
  if sym = #none then
    sym = me.pmode
  end if
  case sym of
    #attach:
      sym = #stand
    #attackObject:
      sym = #attack
  end case
  return ancestor.getAnimSym(sym)
end

on goMode me, newMode
  case me.pmode of
    #attach:
      me.setKeepVect(0)
  end case
  case newMode of
    #attach:
      CounterReset(pAttachCounter)
      me.setLoc(pAttachObj.getLoc())
      me.setKeepVect(1)
  end case
  ancestor.goMode(newMode)
end

on targetGone me
  pAttachObj.unregisterParasite(me)
  me.goMode(#look)
end

on update me
  case me.pmode of
    #attach:
      fin = me.updateAttach()
      if fin then
        me.goMode(#attackObject)
      end if
    #attackObject:
      me.updateAttach()
      fin = me.updateAttack()
      if fin then
        me.attachObjAttacked()
        me.goMode(#stand)
      end if
  end case
  ancestor.update()
end

on updateAttach me
  fin = 0
  if pAttachCounter.fin then
    fin = 1
  end if
  counter(pAttachCounter)
  objLoc = pAttachObj.getLoc()
  me.moveLoc(objLoc)
  return fin
end
