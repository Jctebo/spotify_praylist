param(
  [switch]$VerboseOutput
)

$ErrorActionPreference = "Stop"

if ($VerboseOutput) {
  $args = @("-3", "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v")
} else {
  $args = @("-3", "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py")
}

Write-Host "Running offline local test suite..."
& py @args
if ($LASTEXITCODE -ne 0) {
  throw "Local test suite failed"
}

Write-Host "All local tests passed."
