Pod::Spec.new do |s|
  s.name           = 'FolderAccess'
  s.version        = '0.1.0'
  s.summary        = 'Security-scoped folder access for Remote Library'
  s.description    = 'Selects, restores, and reads an iOS Files folder without copying the library.'
  s.author         = ''
  s.homepage       = 'https://example.invalid'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
