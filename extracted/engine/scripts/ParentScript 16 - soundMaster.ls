property pDefaultVolume, pNextChan, pMixMaster, pSoundList, pSoundsAdded, pActive, pEnable, pSprite, pMyLoc, pAutoSound, pCast, pMemOn, pMemOff, pLastMusic, pMusicChannel, pSFXCast, pSpriteOn
global g

on new me
  return me
end

on init me
  pDefaultVolume = 150
  pAutoSound = 1
  pLastMusic = #none
  pMusicChannel = 1
  pNextChan = 2
  pSFXCast = "sfx"
  pSpriteOn = 0
  numsounds = the number of castMembers of castLib pSFXCast
  if pSpriteOn then
    pCast = cast("soundImages")
    pMemOn = member("soundOn", pCast)
    pMemOff = member("soundOff", pCast)
  end if
  repeat with so = 1 to numsounds
    mem = member(so, pSFXCast)
    if mem.type = #swa then
      mem.preloadTime = integer(mem.duration)
      mem.preloadBuffer()
    end if
  end repeat
  pSoundList = [:]
  repeat with so = 1 to numsounds
    mem = member(so, pSFXCast)
    if mem.type = #swa then
      memname = mem.name
      typname = memname
      delete typname.char[1]
      typsym = typname.symbol
      if not ilk(pSoundList[typsym], #list) then
        countname = typname & "count"
        countsym = countname.symbol
        pSoundList[typsym] = []
        pSoundList[countsym] = 1
      end if
      pSoundList[typsym].append(memname)
    end if
  end repeat
  soundlenth = pSoundList.count
  repeat with so = 1 to soundlenth
    propname = getPropAt(pSoundList, so)
    propval = pSoundList[propname]
    if ilk(propval, #list) then
      proplenth = propval.count
      lenthsym = propname & "lenth"
      lenthsym = lenthsym.symbol
      pSoundList[lenthsym] = proplenth
    end if
  end repeat
  pMixMaster = []
  repeat with chan = 1 to 8
    pMixMaster[chan] = "empty"
  end repeat
  pActive = 1
  pEnable = 1
end

on addSaveData me, sd
  sd[#pActive] = pActive
end

on isMenuItemShadowed me, theComm
  shadowed = 0
  case theComm of
    #soundOn:
      if pActive or (pEnable = 0) then
        shadowed = 1
      end if
    #soundOff:
      if pActive = 0 then
        shadowed = 1
      end if
  end case
  return shadowed
end

on calcVolumeDefault me, vol
  if vol = VOID then
    vol = pDefaultVolume
  end if
  if vol = #none then
    vol = pDefaultVolume
  end if
  return vol
end

on checkRestartMusic me, memberName
  restartMusic = 1
  if memberName = pLastMusic then
    if soundBusy(pMusicChannel) then
      restartMusic = 0
    end if
  end if
  return restartMusic
end

on playMusic me, memberName, vol
  if memberName = "stopMusic" then
    me.stopMusic()
    return 
  end if
  restartMusic = me.checkRestartMusic(memberName)
  if restartMusic = 0 then
    return 
  end if
  soundMember = me.retrieveSoundMember(memberName)
  if soundMember = #none then
    return 
  end if
  if pActive then
    vol = me.calcVolumeDefault(vol)
  end if
  puppetSound(pMusicChannel, soundMember)
  sound(pMusicChannel).volume = vol
  pLastMusic = memberName
end

on PlaySound me, mem, vol
  if mem = member(-1, 1) then
    exit
  end if
  mem = member(mem, pSFXCast)
  if pActive then
    vol = me.calcVolumeDefault(vol)
    if soundBusy(pNextChan) then
      nextchan = SoundEmptyChan()
    else
      nextchan = pNextChan
    end if
    if nextchan > 0 then
      puppetSound(nextchan, mem)
      sound(nextchan).volume = vol
    end if
    VarChangeinRange(pNextChan, 1, 8, 1)
  end if
  return nextchan
end

on adjustVol me, theChan, theVol
  sound(theChan).volume = theVol
end

on retrieveSoundMember me, mem
  soundMember = member(mem, pSFXCast)
  if soundMember = VOID then
    put "soundMaster.retrieveSoundMember() member not found: " & mem
    soundMember = #none
  end if
  return soundMember
end

on restoreFromSave me, sd
  pActive = sd.pActive
end

on stop me
  me.stopAllSound()
end

on stopAllSound me
  repeat with chan = 1 to 8
    me.stopSound(chan)
  end repeat
end

on stopMusic me
  me.stopSound(pMusicChannel)
end

on stopSound me, theChan
  sound(theChan).stop()
end

on newframe me
  pSoundsAdded = 0
end

on checkadded me
  pSoundsAdded = pSoundsAdded + 1
  if pSoundsAdded > 4 then
    Ok = 0
  else
    Ok = 1
  end if
  return Ok
end

on toggle me, which
  if pEnable then
    if not ilk(which, #integer) then
      pActive = not pActive
      pAutoSound = 0
    else
      pActive = which
    end if
  end if
end

on onscreen me
  pMyLoc = point(604, 368)
  updateLoc(me)
end

on offscreen me
  pMyLoc = point(-100, -100)
  updateLoc(me)
end

on updateLoc me
  pSprite.spriteparams.a.loc = pMyLoc
end

on updatesprite me
  updatemember(me)
  updateLoc(me)
end

on disable me
  pEnable = 0
  pActive = 0
end
