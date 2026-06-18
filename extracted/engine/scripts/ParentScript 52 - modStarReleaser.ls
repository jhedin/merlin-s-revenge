property ancestor, pNumOfStarsToBeReleased, pReleaseCooldownCounter
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pNumOfStarsToBeReleased = 0
  pReleaseCooldownCounter = CounterNew()
  pReleaseCooldownCounter.tim[2] = 10
end

on releaseStar me
  pNumOfStarsToBeReleased = pNumOfStarsToBeReleased + 1
end

on update me
  ancestor.update()
  if pNumOfStarsToBeReleased > 0 then
    if pReleaseCooldownCounter.fin then
      g.starMaster.experienceStar(me.big)
      pNumOfStarsToBeReleased = pNumOfStarsToBeReleased - 1
      CounterReset(pReleaseCooldownCounter)
    end if
  end if
  CounterOnce(pReleaseCooldownCounter)
end
