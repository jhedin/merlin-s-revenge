global g

on new me
  return me
end

on init me
end

on start me
  params = g.screenMaster.getParams(#goScreen)
  params.screenSym = #titleScreen
  params.transition = #fade
  params.caller = me
  g.screenMaster.goScreen(params)
end

on buttClicked me, theButt
  if string(theButt) contains "screen" then
    params = g.screenMaster.getParams(#goScreen)
    params.transition = #fade
    case theButt of
      #butt_gameScreen:
        params.screenSym = #gameScreen
    end case
    g.screenMaster.goScreen(params)
  end if
end

on goScreenFinished me
end

on stop me
end
