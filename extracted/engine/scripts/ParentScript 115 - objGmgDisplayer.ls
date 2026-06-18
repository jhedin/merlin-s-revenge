property ancestor, pDisplayLoc, pOffMember, pOnMember, pSpacer, pVerticalSpacerForDisplayCounter
global g, gGlobalDisplayLayer

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i.layer = gGlobalDisplayLayer
  i[#displayLoc] = point(0, 0)
  i[#onMember] = #none
  i[#offMember] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pDisplayLoc = params.displayLoc
  pOffMember = params.offMember
  pOnMember = params.onMember
end

on finish me
  ancestor.finish()
end

on updateActive me, Active
  if Active then
    currentMember = pOnMember
  else
    currentMember = pOffMember
  end if
  me.displayImageAtLoc(currentMember.image, pDisplayLoc)
end
