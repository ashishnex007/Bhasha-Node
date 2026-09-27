; Compile after build_offline.ps1 has created a complete offline bundle.
#define AppName "Bhasha Node"
#define AppVersion "2.1.0"

[Setup]
AppId={{A6CCF716-4CD3-4EEA-8A2B-BA7BD60A0C7E}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\Bhasha Node
DefaultGroupName=Bhasha Node
OutputDir=release-final
OutputBaseFilename=BhashaNode-Setup
Compression=none
SolidCompression=no
DiskSpanning=yes
DiskSliceSize=max
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
UninstallDisplayIcon={app}\icon.ico

[Files]
Source: "bundle\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Bhasha Node"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\launch.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\Bhasha Node"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\launch.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\launch.ps1"""; Description: "Launch Bhasha Node"; Flags: postinstall nowait skipifsilent
