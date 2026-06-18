on CounterReset theC, whichEnd
  if whichEnd = VOID then
    Dir = VarMoreLess(0, theC.inc)
    case Dir of
      1:
        whichEnd = 1
      (-1):
        whichEnd = 2
    end case
  end if
  theC.theCount = theC.tim[whichEnd]
  theC.fin = 0
  theC.looped = 0
  return theC
end
