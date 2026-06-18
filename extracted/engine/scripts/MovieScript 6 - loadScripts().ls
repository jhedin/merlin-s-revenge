on loadScripts me
  loader = new(script("Loader"))
  loader.setLoadFolder(the moviePath & "casts")
  loader.setCasts(["data", "master_objects", "script_objects", "general_functions"])
  loader.setTypesToLoad([#field, #script])
  errors = loader.loadCasts()
  return errors
end
