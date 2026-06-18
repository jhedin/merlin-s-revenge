property ancestor, pTeamToTarget
global g

on new me
  ancestor = new(script("objGameObject"))
  me.addModule("modAnimSet")
  pTeamToTarget = #none
  return me
end

on init me, params
  ancestor.init(params)
  pTeamToTarget = params.teamToTarget
  g.teamMaster.setTeamOverride(pTeamToTarget)
end

on finish me
  g.teamMaster.setTeamOverride(#none)
  ancestor.finish()
end

on update me
  me.ancestor.update()
end
