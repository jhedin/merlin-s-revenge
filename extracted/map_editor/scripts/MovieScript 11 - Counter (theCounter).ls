on counter theC
  if theC.tim[1] = theC.tim[2] then
    theC.fin = 1
    return theC
  end if
  if theC.fin = 1 then
    theC = CounterReset(theC)
    theC.looped = 1
    return theC
  end if
  theC.looped = 0
  theC.theCount = theC.theCount + theC.inc
  if theC.theCount >= theC.tim[2] then
    theC.theCount = theC.tim[2]
    theC.fin = 1
  end if
  if theC.theCount <= theC.tim[1] then
    theC.theCount = theC.tim[1]
    theC.fin = 1
  end if
  return theC
end
