property ancestor, pFlapFrame, pFlapSound, pJumpType

on new me
  ancestor = new(script("objEnemyCharacter"))
  i = me.modifyParams(#init)
  i[#flapFrame] = 3
  i[#jumpType] = #jump
  i[#flapSound] = "flap_wings"
  return me
end

on init me, params
  ancestor.init(params)
  pFlapFrame = params.flapFrame
  pFlapSound = params.flapSound
  pJumpType = params.jumpType
end

on doJump me
  animSym = me.id.bigMe.getAnimSym(#none)
  case animSym of
    #fly:
      if me.getAnimFrame() = pFlapFrame then
        me.id.bigMe.goMode(pJumpType)
        me.PlaySound(pFlapSound)
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
    #reelFly:
      me.frictionYOff()
    #reelLanded:
      me.frictionYOn()
    #lift:
      me.pMoveXY.addVectY(me.pJumpPower)
  end case
  ancestor.goMode(newMode)
end
