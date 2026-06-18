property pFrameRate, pFrameLength, pLastTime, pOutput, pOutputOn, pTimeSample, pTimeSampleLength, pMaxTime, pMaxTimeCount, pTotalFrameTime, pDbg
global g

on new me
  return me
end

on init me
  pFrameRate = 30
  pFrameLength = 1000 / pFrameRate
  pTimeSampleLength = 5
  pMaxTimeCount = CounterNew()
  pMaxTimeCount.tim[2] = 600
  pOutputOn = 1
end

on start me
  pLastTime = the milliSeconds
  pMaxTime = 0
  pTimeSample = []
  pTotalFrameTime = 0
  g.updater.addPrg(me, #hi)
end

on update me
  frameTime = me.getFrameTime()
  me.addFrameTime(frameTime)
  currTime = me.getAverageFrameTime()
  maxTime = me.updateMaxTime(currTime)
  msg = "frameTime: " & currTime & "   maxTime: " & maxTime
  if frameTime < pFrameLength then
    me.waitFrame(frameTime)
  end if
  if pOutputOn then
    put msg
  end if
end

on addFrameTime me, frameTime
  pTimeSample.append(frameTime)
  pTotalFrameTime = pTotalFrameTime + frameTime
  numSamples = pTimeSample.count
  if numSamples > pTimeSampleLength then
    pTotalFrameTime = pTotalFrameTime - pTimeSample[1]
    pTimeSample.deleteAt(1)
  end if
end

on getAverageFrameTime me
  average = pTotalFrameTime / pTimeSampleLength
  return average
end

on getFrameTime me
  currTime = the milliSeconds
  frameTime = currTime - pLastTime
  pLastTime = currTime
  return frameTime
end

on setFrameRate me, newVal
  pFrameRate = newVal
  pFrameLength = 1000 / pFrameRate
end

on updateMaxTime me, currTime
  counter(pMaxTimeCount)
  if pMaxTimeCount.fin then
    pMaxTime = currTime
  end if
  if currTime > pMaxTime then
    pMaxTime = currTime
  end if
  return pMaxTime
end

on waitFrame me, frameTime
  extra = pFrameLength - frameTime
  nFrameSecs = the milliSeconds + extra
  repeat while the milliSeconds < nFrameSecs
  end repeat
  pLastTime = the milliSeconds
end

on stop me
  g.updater.removePrg(me)
end
