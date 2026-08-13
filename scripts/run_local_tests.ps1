param(
  [switch]$VerboseOutput
)

$ErrorActionPreference = "Stop"

Write-Host "Running offline local test suite..."
$python = Get-Command py -ErrorAction SilentlyContinue
if (-not $python) {
  $python = Get-Command python -ErrorAction Stop
}
if ($python.Name -eq "py.exe") {
  $args = @("-3", "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py")
} else {
  $args = @("-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py")
}
if ($VerboseOutput) { $args += "-v" }
& $python.Source @args
if ($LASTEXITCODE -ne 0) {
  throw "Local test suite failed"
}

Write-Host "All local tests passed."
