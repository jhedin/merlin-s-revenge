property ancestor, pToolPalette

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#toolPalette] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pToolPalette = params.toolPalette
end

on getToolPalette me
  return pToolPalette
end
