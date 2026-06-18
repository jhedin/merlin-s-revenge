global g

on testPropertyDialogue
  menCon = g.objectMaster.requestObject(#objMenuController)
  params = menCon.getParams(#init)
  menCon.init(params)
  menCon.newPropertyDialogue("Edit Details", [#name: "Steve", #age: 29], point(290, 64))
end
