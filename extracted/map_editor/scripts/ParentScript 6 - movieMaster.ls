global g

on new me
  return me
end

on init me
  g.updater.addPrg(me, #hi)
end

on start me
  g.frameTimer.start()
  g.titlemaster.start()
end

on update me
end

on stop me
end
