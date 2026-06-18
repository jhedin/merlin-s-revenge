global g

on UtilsTestObjectCreation me
  qty = 100
  pm = g.profileMaster
  pm.t("Test Object Creation qty=" & qty)
  objs = []
  pm.s(#create)
  repeat with i = 1 to qty
    params = g.actorMaster.getParams(#newActor)
    params.typ = #Spell
    params.startLoc = point(100, 100)
    nObj = g.actorMaster.newActor(params)
    objs.append(nObj)
  end repeat
  pm.f()
  pm.s(#finish)
  repeat with nObj in objs
    nObj.finish()
  end repeat
  pm.f()
  objs = []
  pm.s(#recreate)
  repeat with i = 1 to qty
    params = g.actorMaster.getParams(#newActor)
    params.typ = #Spell
    params.startLoc = point(100, 100)
    nObj = g.actorMaster.newActor(params)
    objs.append(nObj)
  end repeat
  pm.f()
  pm.s(#finishSecond)
  repeat with nObj in objs
    nObj.finish()
  end repeat
  pm.f()
  pm.w()
end
