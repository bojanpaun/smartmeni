import { useRef, useEffect, useState } from 'react'
import styles from './LandingEditor.module.css'

const DEVICES = [
  { key: 'desktop', icon: '🖥', width: '100%' },
  { key: 'tablet',  icon: '📓', width: '768px' },
  { key: 'mobile',  icon: '📱', width: '390px' },
]

export default function LandingPreview({ src, blocks }) {
  const iframeRef = useRef()
  const [device, setDevice] = useState('desktop')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'PREVIEW_UPDATE', blocks },
        window.location.origin
      )
    }, 300)
    return () => clearTimeout(t)
  }, [blocks, ready])

  const deviceWidth = DEVICES.find(d => d.key === device)?.width ?? '100%'
  const publicUrl = src.replace('?preview=true', '')

  return (
    <div className={styles.previewPanel}>
      <div className={styles.previewToolbar}>
        <span className={styles.previewLabel}>Preview</span>
        <div className={styles.deviceToggle}>
          {DEVICES.map(({ key, icon }) => (
            <button
              key={key}
              className={`${styles.deviceBtn} ${device === key ? styles.deviceBtnActive : ''}`}
              onClick={() => setDevice(key)}
              title={key}
            >
              {icon}
            </button>
          ))}
        </div>
        <a href={publicUrl} target="_blank" rel="noreferrer" className={styles.openLink}>
          ↗ Otvori
        </a>
      </div>
      <div className={styles.previewFrame}>
        <div className={styles.previewFrameInner} style={{ width: deviceWidth }}>
          <iframe
            ref={iframeRef}
            src={src}
            className={styles.previewIframe}
            title="Preview"
            onLoad={() => setReady(true)}
          />
        </div>
      </div>
    </div>
  )
}
