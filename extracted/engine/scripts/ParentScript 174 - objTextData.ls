property ancestor, pData, pTextData
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#member] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pTextData = params.member.text
  pTextData = StringEliminateChars(pTextData, RETURN)
  pData = value(pTextData)
end

on getData me
  return pData
end

on getTextData me
  return pTextData
end
