property ancestor, pFlapFrame, pJumpType

on new me
  ancestor = new(script("objEnemyCharacter"))
  i = me.pParams[#init]
  i[#flapFrame] = 3
  i[#jumpType] = #jump
  return me
end

on init me, params
  ancestor.init(params)
  pFlapFrame = params.flapFrame
  pJumpType = params.jumpType
end

on doJump me
  animSym = me.id.bigMe.getAnimSym(#none)
  case animSym of
    #fly:
      if me.getAnimFrame() = pFlapFrame then
        me.id.bigMe.goMode(pJumpType)
      end if
    #glide:
      me.id.bigMe.goMode(#jump)
  end case
end

on getAnimSym me, sym
  if sym = #none then
    sym = me.pmode
  end if
  case sym of
    #jump, #landed, #walk, #lift:
      sym = #fly
    #fall:
      sym = #glide
  end case
  return ancestor.getAnimSym(sym)
end

on goMode me, newMode
  case newMode of
    #reel_fly:
      me.frictionYOff()
    #reel_landed:
      me.frictionYOn()
    #lift:
      me.pMoveXY.addVectY(me.pJumpPower)
  end case
  ancestor.goMode(newMode)
end
