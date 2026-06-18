property ancestor, pParams

on new me
  ancestor = new(script("objEventNotify"))
  pParams = [:]
  pParams[#init] = [:]
  i = pParams.init
  i[#flags] = []
  return me
end

on init me, params
  ancestor.init()
  me.pFlags = params.flags
end

on getParams me, function
  if function = VOID then
    function = #init
  end if
  return pParams[function].duplicate()
end

on modifyParams me, function
  if pParams[function] = VOID then
    pParams[function] = [:]
  end if
  return pParams[function]
end
