on CounterPingPong cnt
  cnt.theCount = cnt.theCount + cnt.inc
  if not VarInRange(cnt.theCount, cnt.tim[1], cnt.tim[2]) then
    cnt.theCount = VarKeepInRange(cnt.theCount, cnt.tim[1], cnt.tim[2])
    cnt.inc = cnt.inc * -1
    cnt.fin = 1
  else
    cnt.fin = 0
  end if
  return cnt
end
