import React, { useState, useEffect, useCallback } from 'react'

type InstallStatus = 'checking' | 'installed' | 'not_installed'

export function BlackHoleSetup({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [status, setStatus] = useState<InstallStatus>('checking')
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkInstalled = useCallback(async () => {
    setStatus('checking')
    try {
      // Request permission so labels are available, then check device list
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
      tempStream?.getTracks().forEach(t => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      const found = devices.some(d =>
        d.kind === 'audioinput' && d.label.toLowerCase().includes('blackhole 2ch')
      )
      setStatus(found ? 'installed' : 'not_installed')
      if (found && step === 1) setStep(2)
    } catch {
      setStatus('not_installed')
    }
  }, [step])

  useEffect(() => { checkInstalled() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInstall() {
    setInstalling(true)
    setError(null)
    const err = await window.api.installBlackHole()
    setInstalling(false)
    if (err) {
      setError(`Could not open installer: ${err}`)
    }
    // Installer is async (user goes through PKG wizard); they'll click Recheck
  }

  async function handleOpenMidi() {
    await window.api.openAudioMidiSetup()
  }

  const pill = (label: string, active: boolean) => ({
    background: active ? '#0284c7' : '#e0f2fe',
    border: `1px solid ${active ? '#0284c7' : '#bae6fd'}`,
    borderRadius: 99,
    color: active ? '#fff' : '#64748b',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    width: 22,
    height: 22,
    flexShrink: 0,
    label,
  } as React.CSSProperties & { label: string })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 520, maxWidth: '94vw',
        boxShadow: '0 16px 48px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto'
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>System Audio Setup</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Capture computer audio in screen recordings (macOS only)
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
          background: status === 'installed' ? '#f0fdf4' : status === 'checking' ? '#f8fafc' : '#fff7ed',
          border: `1px solid ${status === 'installed' ? '#86efac' : status === 'checking' ? '#e2e8f0' : '#fed7aa'}`,
          borderRadius: 8, padding: '8px 12px'
        }}>
          <span style={{ fontSize: 16 }}>
            {status === 'installed' ? '✅' : status === 'checking' ? '⏳' : '⚠️'}
          </span>
          <span style={{ fontSize: 12, color: '#334155' }}>
            {status === 'installed'
              ? 'BlackHole 2ch is installed on this Mac.'
              : status === 'checking'
              ? 'Checking for BlackHole 2ch…'
              : 'BlackHole 2ch is not detected on this Mac.'}
          </span>
          <button
            onClick={checkInstalled}
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid #cbd5e1', borderRadius: 5, color: '#475569', cursor: 'pointer', fontSize: 11, padding: '3px 9px' }}
          >
            Recheck
          </button>
        </div>

        {/* Step nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          {([1, 2, 3] as const).map((n, i) => (
            <React.Fragment key={n}>
              <button
                onClick={() => setStep(n)}
                style={{
                  background: step === n ? '#0284c7' : n < step ? '#d1fae5' : '#f1f5f9',
                  border: `1px solid ${step === n ? '#0284c7' : n < step ? '#6ee7b7' : '#e2e8f0'}`,
                  borderRadius: 99, color: step === n ? '#fff' : n < step ? '#065f46' : '#94a3b8',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  padding: '3px 12px', whiteSpace: 'nowrap'
                }}
              >
                {n < step ? '✓ ' : ''}{['Install BlackHole', 'Create Multi-Output Device', 'Select & Record'][n - 1]}
              </button>
              {i < 2 && <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginTop: 0 }}>
              BlackHole is a free, open-source virtual audio driver that routes your Mac's system audio into recordings. Without it, screen recordings will have microphone audio only — no computer audio.
            </p>

            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#0284c7', marginBottom: 6 }}>What the installer does</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                <li>Installs a virtual audio device called "BlackHole 2ch"</li>
                <li>Requires your admin password (standard macOS driver install)</li>
                <li>You may need to log out and back in, or restart, for it to appear</li>
                <li>Does not affect your existing speakers or microphone</li>
              </ul>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', color: '#dc2626', fontSize: 12, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleInstall}
                disabled={installing || status === 'installed'}
                style={{
                  background: status === 'installed' ? '#6ee7b7' : '#0284c7',
                  border: 'none', borderRadius: 7, color: '#fff', cursor: installing || status === 'installed' ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 600, padding: '9px 18px', flex: 1
                }}
              >
                {status === 'installed' ? '✓ Already installed' : installing ? 'Opening installer…' : '⬇ Install BlackHole 2ch'}
              </button>
              {status === 'not_installed' && (
                <button
                  onClick={() => setStep(2)}
                  style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, color: '#475569', cursor: 'pointer', fontSize: 12, padding: '9px 14px' }}
                >
                  Already installed →
                </button>
              )}
            </div>

            {status !== 'installed' && (
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 0, marginTop: 10, textAlign: 'center' }}>
                After the installer finishes, click Recheck above, then continue to Step 2.
              </p>
            )}

            {status === 'installed' && (
              <button
                onClick={() => setStep(2)}
                style={{ marginTop: 10, background: '#0284c7', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '9px 18px', width: '100%' }}
              >
                Continue to Step 2 →
              </button>
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginTop: 0 }}>
              To hear your speakers <em>and</em> capture system audio simultaneously, create a <strong>Multi-Output Device</strong> in Audio MIDI Setup that combines your speakers and BlackHole together.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {[
                { n: '1', text: 'Click the button below to open Audio MIDI Setup.' },
                { n: '2', text: 'In the bottom-left corner, click the + button and choose "Create Multi-Output Device".' },
                { n: '3', text: 'In the right panel, check both your speakers/headphones (e.g. "MacBook Pro Speakers" or "External Headphones") and "BlackHole 2ch".' },
                { n: '4', text: 'Check "Use This Device For Sound Output" next to your speaker device by right-clicking the new Multi-Output Device in the list.' },
                { n: '5', text: 'Optionally rename it — e.g. "Speakers + BlackHole" — by double-clicking the name.' },
              ].map(({ n, text }) => (
                <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ ...pill(n, false), background: '#e0f2fe', color: '#0369a1' }}>{n}</div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{text}</div>
                </div>
              ))}
            </div>

            <button
              onClick={handleOpenMidi}
              style={{ background: '#7c3aed', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '9px 18px', width: '100%', marginBottom: 10 }}
            >
              Open Audio MIDI Setup →
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, color: '#475569', cursor: 'pointer', fontSize: 12, padding: '8px 14px' }}>← Back</button>
              <button onClick={() => setStep(3)} style={{ background: '#0284c7', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 18px', flex: 1 }}>Done — Continue to Step 3 →</button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginTop: 0 }}>
              Everything is set up. Here's how to capture system audio in your next screen recording:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[
                { n: '1', color: '#0284c7', text: 'Go to System Settings → Sound → Output and select your "Speakers + BlackHole" Multi-Output Device (or whatever you named it). Your audio will route through both.' },
                { n: '2', color: '#0284c7', text: 'Back in this app, click "⏺ Record Screen" and pick the window or screen you want to record.' },
                { n: '3', color: '#0284c7', text: 'Enable the "Include mic" option in the recording picker if you also want your voice.' },
                { n: '4', color: '#0284c7', text: 'When you stop and save the recording, system audio will be included in the file.' },
                { n: '5', color: '#64748b', text: 'When done recording, remember to switch your Sound Output back to your regular speakers so audio doesn\'t keep routing through BlackHole.' },
              ].map(({ n, color, text }) => (
                <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ ...pill(n, false), background: color === '#0284c7' ? '#e0f2fe' : '#f1f5f9', color }}>{n}</div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{text}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#713f12' }}>
              <strong>Tip:</strong> You can automate the Sound Output switch with a free app like <em>SoundSource</em> or <em>Audio Switcher</em> if you record frequently.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(2)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, color: '#475569', cursor: 'pointer', fontSize: 12, padding: '8px 14px' }}>← Back</button>
              <button onClick={onClose} style={{ background: '#059669', border: 'none', borderRadius: 7, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '8px 18px', flex: 1 }}>✓ Got it — close setup</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
