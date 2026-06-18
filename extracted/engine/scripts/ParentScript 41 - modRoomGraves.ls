property ancestor, pGraves
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pGraves = []
end

on addSaveData me, sd
  sd[#pGraves] = pGraves.duplicate()
  ancestor.addSaveData(sd)
end

on drawAndRecordGrave me, theObj
  graveMember = theObj.getGraveMember()
  graveImage = graveMember.image
  graveRect = RectOfMemberDrawnAtLoc(graveMember, theObj.getLoc())
  me.drawGrave(graveImage, graveRect)
  me.recordGrave(graveMember, graveRect, theObj)
end

on drawGrave me, theImage, therect
  roomImage = me.getMember().image
  roomLocOnScreen = me.id.bigMe.getLoc()
  therect = therect - rect(roomLocOnScreen, roomLocOnScreen)
  drawParams = [#useFastQuads: 1, #ink: 36]
  roomImage.copyPixels(theImage, therect, theImage.rect, drawParams)
end

on recordGrave me, theMember, therect, theObj
  newGrave = g.structMaster.getStruct(#graveRecord)
  newGrave.actorType = theObj.getActorType()
  newGrave.member = theMember
  newGrave.rect = therect
  pGraves.append(newGrave)
end

on reDrawGraves me
  repeat with grave in pGraves
    me.drawGrave(grave.member.image, grave.rect)
  end repeat
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pGraves = sd.pGraves
end
