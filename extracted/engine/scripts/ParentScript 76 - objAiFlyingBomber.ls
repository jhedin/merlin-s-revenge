property ancestor
global g

on new me
  ancestor = new(script("objAiCPU"))
  return me
end

on update me
  case me.pmode of
    #moveToAttack:
      fin = me.id.bigMe.updateMoveToAttack()
      if fin then
        me.id.bigMe.goMode(#attack)
      end if
    #attack:
      fin = me.updateAttack()
      if fin then
        me.id.bigMe.goMode(#moveToAttack)
      end if
  end case
  CounterOnce(me.pAttack.cooldownCounter)
end

on updateMoveToAttack me
  if me.pPlayer = #none then
    me.pPlayer = g.actorMaster.getPlayer()
  end if
  attackLoc = me.pAttack.idealAttackLoc.duplicate()
  reach = me.pAttack.reach
  idealRect = me.pPlayer.getRect() + rect(attackLoc, attackLoc)
  attackRect = me.pPlayer.getRect().inflate(reach[1], reach[2])
  me.updateMoveToRect(idealRect)
  inRect = me.checkInRect(attackRect)
  if inRect = 1 then
    fin = 1
  else
    fin = 0
  end if
  return fin
end
