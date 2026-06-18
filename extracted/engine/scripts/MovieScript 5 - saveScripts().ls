on saveScripts me
  extractor = new(script("Extractor"))
  extractor.setExFolder(the moviePath & "casts/")
  extractor.setCasts(["data", "master_objects", "script_objects", "general_functions"])
  extractor.setTypesToExtract([#field, #script])
  extractor.start()
  put "Done"
end
