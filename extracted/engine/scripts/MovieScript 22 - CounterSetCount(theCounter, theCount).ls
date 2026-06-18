on CounterSetCount theCounter, theCount
  theCounter.theCount = theCount
  theCounter.looped = 0
  countDir = VarMoreLess(theCounter.inc, 0)
  if countDir = 1 then
    theCounter.fin = theCounter.theCount = theCounter.tim[1]
  else
    theCounter.fin = theCounter.theCount = theCounter.tim[2]
  end if
end
