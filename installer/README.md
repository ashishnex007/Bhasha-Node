# Updating the Bhasha Node installer

The installer contains a **snapshot** of the bundled app. It does not link to the
repository or automatically pick up later edits. Rebuild it after changing code.

## Normal update: frontend, backend code, labels or icons

1. Finish and test your code changes.
2. Keep `installer/bundle` intact. It contains the standalone Python runtime,
   packages, local tools and models needed to rebuild an offline installer.
3. If you are running the app from **that bundle**, stop its backend first. Merely
   closing the browser does not stop the backend. In Task Manager, identify the
   Python process by its `installer\bundle\runtime\python.exe` command line and
   stop only that process. A development server using `server\venv` may stay open.
4. Open PowerShell and run:

   ```powershell
   Set-Location 'C:\Projects\pers\baif'
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\update_installer.ps1
   ```

The script builds the frontend, replaces the app code in the existing bundle,
checks that each copied file matches the current code, validates the offline
assets/runtime, and compiles the installer. It includes saved uncommitted edits.
It does not change the app source or installed user data. IndicCOMET is optional.

The builder needs Node/npm and Inno Setup 6 on the developer machine. These are
**not required on the user's installation machine**. This workstation's compiler
is found automatically at:
`C:\Users\ashis\AppData\Local\Programs\Inno Setup 6\ISCC.exe`.

For a custom compiler location or a new installer version:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\installer\update_installer.ps1 `
  -Version 2.1.2 `
  -InnoCompiler 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
```

`-Version` controls the Setup version shown by Windows. It does not change the
backend's `APP_VERSION`. The default Setup version is 2.1.1.

## Which folders/files to keep

| Path | Purpose |
| --- | --- |
| `installer/release-final` | Current distributable installer and build information. |
| `installer/release` | Older build output; unused by the current recipe. You may remove it when you no longer need that old build. |
| `installer/bundle` | Build input containing app code, runtime, tools and models. Keep it for future updates. |

Send **both** `BhashaNode-Setup.exe` and `BhashaNode-Setup-1.bin` together. If a
future build produces more numbered `.bin` files, include all of them. The EXE
alone is not the full offline installer. `BUILD-INFO.json` records when the build
was made and the SHA-256 hashes of the copied app files; it is not required to
install the app. Running only `ISCC.exe` would package whatever is already in the
bundle, which may be stale. Use `update_installer.ps1` after code edits.

To update an installed copy, stop its running backend, then run the new Setup
against the same installation folder. The recipe keeps the same AppId. User
results and history remain under `%LOCALAPPDATA%\BhashaNode`, separate from the
installation directory.

## When dependencies, tools or models change

The quick update intentionally reuses the existing runtime and models. It stops
if `server/requirements.txt` differs from the bundled requirements. Installing a
package into the development venv does not update the installer runtime.

For dependency/model changes, use `build_offline.ps1` to create a fresh bundle
with a standalone Python base, tested packages, the CPU PyTorch wheel, FFmpeg,
Poppler, Tesseract and the local Hugging Face cache. See its required parameters:

```powershell
Get-Help .\installer\build_offline.ps1 -Full
```

That script requires `installer/bundle` not to exist. Stop any bundled backend
and move the old bundle to a separate backup location before creating the new
one. Supply `-InnoCompiler` if Inno is installed outside its default system path.
After the full bundle build succeeds, run `update_installer.ps1` again so the
current application code and requested Setup version are verified and packaged.

Compilation and portable-bundle checks are distinct from testing installation,
desktop/Start Menu shortcuts, upgrading and uninstalling on a clean Windows PC.
