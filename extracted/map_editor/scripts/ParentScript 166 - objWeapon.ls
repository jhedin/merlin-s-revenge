property ancestor, pAttack, pAnimSet, pmode, pOwner, pRotationSpeed, pTransRotate, pType
global g

on new me
  ancestor = new(script("objGameObject"))
  i = me.pParams.init
  i[#rotationSpeed] = 20
  i[#attack] = g.structMaster.getStruct(#attack)
  return me
end

on init me, params
  ancestor.init(params)
  pAnimSet = g.objectMaster.requestObject(#objAnimSet)
  pAnimSet.init(params.name, params.character)
  pAttack = params.attack
  pOwner = #none
  pRotationSpeed = params.rotationSpeed
  pTransRotate = #none
  pType = symbol(params.name)
  g.weaponMaster.register(pType, me)
  me.goMode(#fall)
  me.updateAnim()
end

on AiModeChanged me, newAiMode
  if me.isCarried() then
    case newAiMode of
      #attack:
        me.goMode(#attack)
        me.pAnimSet.resetAnim(#attack)
      #dazed:
        me.ensureMode(#fall)
      #moveToAttack:
        me.ensureMode(#carried)
    end case
  end if
end

on collisionPlatform me
  ancestor.collisionPlatform()
  me.goMode(#landed)
end

on drop me
  me.id.bigMe.goMode(#fall)
end

on ensureMode me, theMode
  if pmode <> theMode then
    me.goMode(theMode)
  end if
end

on finish me
  me.goMode(#finish)
  g.weaponMaster.unRegister(pType, me)
  pAnimSet.finish()
  ancestor.finish()
end

on getAttack me
  return pAttack.duplicate()
end

on goMode me, newMode
  case pmode of
    #carried, #attack:
      case newMode of
        #carried, #attack:
          nothing()
        otherwise:
          if pOwner <> #none then
            pOwner.droppedWeapon()
          end if
      end case
    #fall:
      pTransRotate.cancel()
  end case
  case newMode of
    #fall:
      me.frictionXOff()
      pTransRotate = g.objectMaster.requestObject(#objTransRotate)
      pTransRotate.init(me, me.pSpr)
      pTransRotate.setSpeed(pRotationSpeed)
      pTransRotate.calcStart()
    #landed:
      me.frictionXOn()
  end case
  pmode = newMode
end

on isCarried me
  case pmode of
    #fall, #landed:
      return 0
    otherwise:
      return 1
  end case
end

on pickedUp me, byWhom
  pOwner = byWhom
  me.id.bigMe.goMode(#carried)
end

on takeHit me, collideVect
  ancestor.takeHit(collideVect)
  me.goMode(#fall)
end

on transformFin me
  nothing()
end

on update me
  case pmode of
    #attack, #carried:
      me.updateCarried()
  end case
  me.updateAnim()
  ancestor.update()
end

on updateAI me
  me.checkCollisionsWithHair()
end

on updateAnim me
  sym = pmode
  case sym of
    #landed:
      sym = #carried
  end case
  SpriteSetMember(me.pSpr, pAnimSet.getMember(sym))
end

on updateCarried me
  ownerLoc = pOwner.getLoc()
  ownerFlip = pOwner.getFlip()
  me.setLoc(ownerLoc)
  me.setFlip(ownerFlip)
end
