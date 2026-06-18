property ancestor
global g

on new me
  ancestor = new(script("objAiEnemy"))
  return me
end

on init me, player
  ancestor.init(player)
end

on updateMoveToAttack me
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
