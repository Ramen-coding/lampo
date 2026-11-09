require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "telecomando-biometrics"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://example.invalid"
  s.license      = "MIT"
  s.authors      = "Telecomando"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :path => "." }
  s.source_files = "ios/*.{h,m}"
  s.frameworks   = "LocalAuthentication"
  install_modules_dependencies(s)
end
