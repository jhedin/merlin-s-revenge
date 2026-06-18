property ancestor, p

on new me
  me.ancestor = new(script("objBasic"))
  return me
end

on init me, values
  p = [:]
  p[#counter] = CounterNew()
  p[#values] = []
  me.setValues(values)
end

on setValues me, values
  if ilk(values) = #list then
    p.values = values.duplicate()
    p.counter.tim[2] = p.values.count
    CounterReset(p.counter)
  else
    put "objList.setValues: values not a list"
  end if
end

on getFin me
  return p.counter.fin
end

on getLooped me
  return p.counter.looped
end

on getIndex me
  return p.counter.theCount - 1
end

on nextValue me
  nValue = p.values[p.counter.theCount]
  counter(p.counter)
  return nValue
end

on reset me
  CounterReset(p.counter)
end
