# Turns the enriched Kimberly Gonzalez bundle into a SMART Health Link (U flag):
#   1. inline note/report text so the shared bundle is self-contained
#   2. DEFLATE + encrypt as compact JWE (alg dir, enc A256GCM)
#   3. write the JWE to the repo (served by raw.githubusercontent.com, which
#      ignores the ?recipient= query that viewers must send; HAPI rejects it)
#   4. decrypt the file locally, and if it is already pushed, fetch it the way
#      a viewer would and confirm it matches
#   5. write the shlink:/ URI and a QR page
# The key is kept in shl-secret.json so re-runs keep the same link.
# shl-secret.json and shl.html contain the decryption key: they are gitignored.
# After pushing, run with -VerifyOnly to check the live file without re-encrypting.
param(
  [string]$Bundle = (Join-Path $PSScriptRoot 'GPX-SYN-0000000279-0_enriched.json'),
  [string]$FileUrl = 'https://raw.githubusercontent.com/crookhaven/M5-Health/main/synthetic-patients/shl/kimberly-gonzalez.jwe',
  [string]$JweOut = (Join-Path $PSScriptRoot '..\shl\kimberly-gonzalez.jwe'),
  [string]$Label = 'Kimberly Gonzalez - synthetic test record',
  [string]$SecretFile = (Join-Path $PSScriptRoot 'shl-secret.json'),
  [string]$QrPage = (Join-Path $PSScriptRoot 'shl.html'),
  [switch]$NewKey,
  [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Remove-TypeData System.Array -ErrorAction SilentlyContinue  # PS 5.1: keeps ConvertTo-Json arrays clean

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CngAesGcm {
  [StructLayout(LayoutKind.Sequential)]
  struct AuthInfo {
    public int cbSize; public int dwInfoVersion;
    public IntPtr pbNonce; public int cbNonce;
    public IntPtr pbAuthData; public int cbAuthData;
    public IntPtr pbTag; public int cbTag;
    public IntPtr pbMacContext; public int cbMacContext;
    public int cbAAD; public long cbData; public int dwFlags;
  }
  [DllImport("bcrypt.dll", CharSet = CharSet.Unicode)] static extern uint BCryptOpenAlgorithmProvider(out IntPtr h, string alg, string impl, uint flags);
  [DllImport("bcrypt.dll", CharSet = CharSet.Unicode)] static extern uint BCryptSetProperty(IntPtr h, string prop, byte[] input, int cb, uint flags);
  [DllImport("bcrypt.dll")] static extern uint BCryptGenerateSymmetricKey(IntPtr hAlg, out IntPtr hKey, IntPtr obj, int cbObj, byte[] secret, int cbSecret, uint flags);
  [DllImport("bcrypt.dll")] static extern uint BCryptEncrypt(IntPtr hKey, byte[] input, int cbInput, ref AuthInfo info, IntPtr iv, int cbIv, byte[] output, int cbOutput, out int cbResult, uint flags);
  [DllImport("bcrypt.dll")] static extern uint BCryptDecrypt(IntPtr hKey, byte[] input, int cbInput, ref AuthInfo info, IntPtr iv, int cbIv, byte[] output, int cbOutput, out int cbResult, uint flags);
  [DllImport("bcrypt.dll")] static extern uint BCryptDestroyKey(IntPtr h);
  [DllImport("bcrypt.dll")] static extern uint BCryptCloseAlgorithmProvider(IntPtr h, uint flags);

  static byte[] Run(bool encrypt, byte[] key, byte[] nonce, byte[] input, byte[] aad, byte[] tag) {
    IntPtr hAlg, hKey;
    Check(BCryptOpenAlgorithmProvider(out hAlg, "AES", null, 0), "open");
    try {
      byte[] mode = System.Text.Encoding.Unicode.GetBytes("ChainingModeGCM\0");
      Check(BCryptSetProperty(hAlg, "ChainingMode", mode, mode.Length, 0), "mode");
      Check(BCryptGenerateSymmetricKey(hAlg, out hKey, IntPtr.Zero, 0, key, key.Length, 0), "key");
      GCHandle hn = GCHandle.Alloc(nonce, GCHandleType.Pinned), ha = GCHandle.Alloc(aad, GCHandleType.Pinned), ht = GCHandle.Alloc(tag, GCHandleType.Pinned);
      try {
        AuthInfo info = new AuthInfo();
        info.cbSize = Marshal.SizeOf(typeof(AuthInfo)); info.dwInfoVersion = 1;
        info.pbNonce = hn.AddrOfPinnedObject(); info.cbNonce = nonce.Length;
        info.pbAuthData = ha.AddrOfPinnedObject(); info.cbAuthData = aad.Length;
        info.pbTag = ht.AddrOfPinnedObject(); info.cbTag = tag.Length;
        byte[] output = new byte[input.Length]; int written;
        uint st = encrypt
          ? BCryptEncrypt(hKey, input, input.Length, ref info, IntPtr.Zero, 0, output, output.Length, out written, 0)
          : BCryptDecrypt(hKey, input, input.Length, ref info, IntPtr.Zero, 0, output, output.Length, out written, 0);
        Check(st, encrypt ? "encrypt" : "decrypt (bad key or tampered data)");
        return output;
      } finally { hn.Free(); ha.Free(); ht.Free(); BCryptDestroyKey(hKey); }
    } finally { BCryptCloseAlgorithmProvider(hAlg, 0); }
  }
  static void Check(uint status, string step) { if (status != 0) throw new Exception("CNG " + step + " failed: 0x" + status.ToString("X8")); }
  public static byte[] Encrypt(byte[] key, byte[] nonce, byte[] plain, byte[] aad, byte[] tagOut) { return Run(true, key, nonce, plain, aad, tagOut); }
  public static byte[] Decrypt(byte[] key, byte[] nonce, byte[] cipher, byte[] aad, byte[] tag) { return Run(false, key, nonce, cipher, aad, tag); }
}
'@

function B64U([byte[]]$b) { [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
function FromB64U([string]$s) { $s = $s.Replace('-', '+').Replace('_', '/'); switch ($s.Length % 4) { 2 { $s += '==' } 3 { $s += '=' } }; [Convert]::FromBase64String($s) }
function RandomBytes([int]$n) { $b = New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $b }
function Deflate([byte[]]$b) {
  $ms = New-Object IO.MemoryStream
  $ds = New-Object IO.Compression.DeflateStream($ms, [IO.Compression.CompressionMode]::Compress)
  $ds.Write($b, 0, $b.Length); $ds.Close(); $ms.ToArray()
}
function Inflate([byte[]]$b) {
  $ds = New-Object IO.Compression.DeflateStream((New-Object IO.MemoryStream(, $b)), [IO.Compression.CompressionMode]::Decompress)
  $out = New-Object IO.MemoryStream; $ds.CopyTo($out); $ds.Close(); $out.ToArray()
}

function Open-Jwe([string]$text, [byte[]]$key) {
  $p = $text.Trim().Split('.')
  if ($p.Count -ne 5) { throw 'Not a compact JWE' }
  $dec = [CngAesGcm]::Decrypt($key, (FromB64U $p[2]), (FromB64U $p[3]), [Text.Encoding]::ASCII.GetBytes($p[0]), (FromB64U $p[4]))
  [Text.Encoding]::UTF8.GetString((Inflate $dec)) | ConvertFrom-Json
}
$secret = $null
if ((Test-Path $SecretFile) -and -not $NewKey) { $secret = [IO.File]::ReadAllText($SecretFile) | ConvertFrom-Json }

if ($VerifyOnly) {
  if (-not $secret) { throw "No $SecretFile; run without -VerifyOnly first" }
  $keyB64u = $secret.key
  $jwe = [IO.File]::ReadAllText($JweOut).Trim()
} else {
  # ---------- 1. self-contained bundle ----------
  $b = [IO.File]::ReadAllText($Bundle) | ConvertFrom-Json
  $binData = @{}
  foreach ($e in $b.entry) { if ($e.resource.resourceType -eq 'Binary') { $binData[$e.fullUrl] = $e.resource.data } }
  $inlined = 0
  foreach ($e in $b.entry) {
    $r = $e.resource
    $atts = @()
    if ($r.resourceType -eq 'DocumentReference') { $atts = @($r.content | ForEach-Object { $_.attachment }) }
    if ($r.resourceType -eq 'DiagnosticReport' -and $r.presentedForm) { $atts = @($r.presentedForm) }
    foreach ($a in $atts) {
      if ($a.url -and $binData.ContainsKey($a.url) -and -not $a.data) { $a | Add-Member -NotePropertyName data -NotePropertyValue $binData[$a.url]; $inlined++ }
    }
  }
  $plain = [Text.Encoding]::UTF8.GetBytes(($b | ConvertTo-Json -Depth 64 -Compress))
  "Bundle: $(@($b.entry).Count) entries, $inlined attachments inlined, $([math]::Round($plain.Length / 1KB)) KB"

  # ---------- 2. encrypt (compact JWE) ----------
  if ($secret -and $secret.url -eq $FileUrl) { $keyB64u = $secret.key } else { $keyB64u = B64U (RandomBytes 32) }
  $header = B64U ([Text.Encoding]::UTF8.GetBytes('{"alg":"dir","enc":"A256GCM","cty":"application/fhir+json","zip":"DEF"}'))
  $iv = RandomBytes 12
  $tag = New-Object byte[] 16
  $cipher = [CngAesGcm]::Encrypt((FromB64U $keyB64u), $iv, (Deflate $plain), [Text.Encoding]::ASCII.GetBytes($header), $tag)
  $jwe = "$header..$(B64U $iv).$(B64U $cipher).$(B64U $tag)"

  # ---------- 3. write the file for the repo ----------
  New-Item -ItemType Directory -Force (Split-Path $JweOut) | Out-Null
  [IO.File]::WriteAllText($JweOut, $jwe, (New-Object Text.ASCIIEncoding))
  "JWE: $([math]::Round($jwe.Length / 1KB)) KB -> $((Resolve-Path $JweOut).Path)"
}
$key = FromB64U $keyB64u

# ---------- 4. verify: local decrypt, then the live URL as a viewer fetches it ----------
$round = Open-Jwe $jwe $key
"Local decrypt OK: $($round.resourceType) ($($round.type)), $(@($round.entry).Count) entries, patient $($round.entry[0].resource.name[0].given[0]) $($round.entry[0].resource.name[0].family)"
try {
  $got = Invoke-WebRequest -Uri "$FileUrl`?recipient=SHL%20check" -UseBasicParsing -Headers @{ Accept = '*/*'; Origin = 'https://viewer.example' }
  $body = if ($got.Content -is [byte[]]) { [Text.Encoding]::ASCII.GetString($got.Content) } else { [string]$got.Content }
  [void](Open-Jwe $body $key)
  "Live URL OK: $($got.StatusCode), CORS Access-Control-Allow-Origin: $($got.Headers['Access-Control-Allow-Origin']), decrypts, identical to local file: $($body.Trim() -eq $jwe)"
} catch {
  "Live URL not serving this file yet ($($_.Exception.Message)). Push the repo, then run: .\make_shl.ps1 -VerifyOnly"
}
if ($VerifyOnly) { return }

# ---------- 5. the link ----------
$payload = [ordered]@{ url = $FileUrl; flag = 'U'; key = $keyB64u; label = $Label; v = 1 }
$shlink = 'shlink:/' + (B64U ([Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress))))
[IO.File]::WriteAllText($SecretFile, ([ordered]@{ shlink = $shlink; url = $FileUrl; key = $keyB64u; label = $Label; created = (Get-Date).ToString('o') } | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
$fileUrl = $FileUrl

$html = @"
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kimberly Gonzalez SHL</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--muted:#555;--card:#f4f4f2;--line:#ddd}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--muted:#aaa;--card:#1f1f1f;--line:#333}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 16px}
h1{font-size:20px;margin:0 0 4px}p{color:var(--muted);margin:0 0 16px}
#qr{background:#fff;padding:16px;display:inline-block;border-radius:8px}
textarea{width:100%;box-sizing:border-box;height:110px;font:12px/1.4 ui-monospace,monospace;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:8px}
button{margin-top:8px;padding:6px 14px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
</style></head><body><main>
<h1>Kimberly Gonzalez &middot; SMART Health Link</h1>
<p>Synthetic test record (HTEST). Flag U, no passcode. Anyone with this link or QR code can decrypt the record.</p>
<div id="qr"></div>
<h2 style="font-size:15px;margin:20px 0 6px">Link</h2>
<textarea id="link" readonly>$shlink</textarea>
<button onclick="navigator.clipboard.writeText(document.getElementById('link').value)">Copy link</button>
<p style="margin-top:16px">Encrypted file: $fileUrl</p>
</main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>new QRCode(document.getElementById('qr'),{text:document.getElementById('link').value,width:320,height:320,correctLevel:QRCode.CorrectLevel.M});</script>
</body></html>
"@
[IO.File]::WriteAllText($QrPage, $html, (New-Object Text.UTF8Encoding($false)))
"SHL ($($shlink.Length) chars) written to $SecretFile and $QrPage"
