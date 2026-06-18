property ancestor
global g

on new me
  ancestor = new(script("objTextData"))
  i = me.modifyParams(#init)
  i[#member] = #none
  return me
end
