$ErrorActionPreference = "Stop"

[ordered]@{
    schema = "synapse.skill.safe-system-inventory.v1"
    os_version = [Environment]::OSVersion.VersionString
    os_architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    process_architecture = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
    processor_count = [Environment]::ProcessorCount
    powershell_version = $PSVersionTable.PSVersion.ToString()
    mutation_started = $false
    network_started = $false
} | ConvertTo-Json -Compress
