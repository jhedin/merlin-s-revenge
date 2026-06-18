on MovieBakeCasts me
  castNames = ["main", "general_functions", "script_objects", "master_objects"]
  internalSuffix = "_int"
  repeat with castname in castNames
    nFromCast = castLib(castname).number
    nToCast = castLib(castname & internalSuffix).number
    CastCopy(nFromCast, nToCast)
  end repeat
end
