Pod::Spec.new do |s|
  s.name           = 'HiddenPhotoLibrary'
  s.version        = '0.1.0'
  s.summary        = 'Read-only access to the iOS Hidden smart album'
  s.description    = 'Fetches hidden PhotoKit assets without modifying the photo library.'
  s.author         = ''
  s.homepage       = 'https://example.invalid'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Photos'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
