global gErrorTrace

on alertHook me, err, msg, var1, var2
  the debugPlaybackEnabled = 1
  setPref("error_log", string(gErrorTrace))
  return 1
end
