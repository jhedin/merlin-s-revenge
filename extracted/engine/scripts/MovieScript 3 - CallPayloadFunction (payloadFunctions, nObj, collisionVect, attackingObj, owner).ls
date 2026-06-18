on CallPayloadFunction payloadFunctions, nObj, collisionVect, attackingObj, owner
  if ilk(payloadFunctions, #list) then
    repeat with payLoadFunction in payloadFunctions
      case payLoadFunction of
        #armyTeleportOut, #takeHeal, #takeHit, #takeFreeze:
          call(payLoadFunction, nObj, collisionVect, attackingObj, owner)
        #none:
          nothing()
      end case
    end repeat
  else
    case payloadFunctions of
      #armyTeleportOut, #takeHeal, #takeHit, #takeFreeze:
        call(payloadFunctions, nObj, collisionVect, attackingObj, owner)
      #none, #void, VOID:
        nothing()
    end case
  end if
end
