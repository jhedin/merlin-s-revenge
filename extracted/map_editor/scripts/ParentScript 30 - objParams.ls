property ancestor, pParams

on new me
  ancestor = new(script("objBasic"))
  pParams = [:]
  pParams[#init] = [:]
  return me
end

on init me, params
end

on getParams me, function
  if function = VOID then
    function = #init
  end if
  return pParams[function]
end

on modifyParams me, function
  if pParams[function] = VOID then
    pParams[function] = [:]
  end if
  return pParams[function]
end
