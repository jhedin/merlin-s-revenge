property ancestor, pEventsElsewhere, pEventsHere
global g, gErrorTrace

on new me
  ancestor = new(script("objBasic"))
  return me
end

on init me
  pEventsElsewhere = [:]
  pEventsHere = [:]
end

on finish me
  ancestor.finish()
  me.cancelRequestsIMade()
  pEventsElsewhere = [:]
  pEventsHere = [:]
end

on appendEventNotify me, thelist, theObj, theEvent, frequency
  if thelist[theEvent] = VOID then
    thelist[theEvent] = []
  end if
  pos = ListGetPosByProp(thelist[theEvent], #obj, theObj)
  if pos > 0 then
    return 
  end if
  eventNotify = g.structMaster.getStruct(#eventNotify)
  eventNotify.obj = theObj
  eventNotify.frequency = frequency
  thelist[theEvent].append(eventNotify)
end

on cancelEventNotification me, theObj, theEvent
  eventList = pEventsHere[theEvent]
  if eventList = VOID then
    return 
  end if
  pos = ListGetPosByProp(eventList, #obj, theObj)
  if pos > 0 then
    eventList.deleteAt(pos)
  end if
end

on cancelRequestsIMade me
  if ilk(pEventsElsewhere) <> #void then
    repeat with i = 1 to pEventsElsewhere.count
      theEvent = pEventsElsewhere.getPropAt(i)
      eventList = pEventsElsewhere[i]
      repeat with eventNotify in eventList
        eventNotify.obj.cancelEventNotification(me.big, theEvent)
      end repeat
    end repeat
  end if
end

on eventNotification me, theEvent, theObj
  eventList = pEventsElsewhere[theEvent]
  repeat with i = eventList.count down to 1
    eventNotify = eventList[i]
    if eventNotify.obj = theObj then
      if eventNotify.frequency = #once then
        eventList.deleteAt(i)
      end if
    end if
  end repeat
end

on eventNotify me, theEvent
  eventList = pEventsHere[theEvent]
  if eventList = VOID then
    return 
  end if
  numInList = eventList.count
  repeat with i = numInList down to 1
    eventNotify = eventList[i]
    eventNotify.obj.eventNotification(theEvent, me.big)
    if eventNotify.frequency = #once then
      eventList.deleteAt(i)
    end if
  end repeat
end

on internalEvent me, theEvent
end

on keepMePosted me, theObj, theEvent, frequency
  me.appendEventNotify(pEventsElsewhere, theObj, theEvent, frequency)
  theObj.requestNotification(me.big, theEvent, frequency)
end

on requestNotification me, theObj, theEvent, frequency
  me.appendEventNotify(pEventsHere, theObj, theEvent, frequency)
end
