import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './LandingEditor.module.css'

const DEVICES = [
  { key: 'desktop', icon: '🖥', width: '100%' },
  { key: 'tablet',  icon: '📓', width: '768px' },
  { key: 'mobile',  icon: '📱', width: '390px' },
]

export default function LandingPreview({ src, blocks, onClose }) {
  const { t } = useTranslation('admin')
  const iframeRef = useRef()
  const [device, setDevice] = useState('desktop')
  const [ready, setReady] = useState(false)
  const [iframeHeight, setIframeHeight] = useState(1500)

  // Send blocks to iframe on change
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

  // Receive content height from iframe
  useEffect(() => {
    const handler = (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'PREVIEW_HEIGHT') setIframeHeight(e.data.height)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const deviceWidth = DEVICES.find(d => d.key === device)?.width ?? '100%'
  const publicUrl = src.replace('?preview=true', '')

  return (
    <div className={styles.previewPanel}>
      <div className={styles.previewToolbar}>
        <span className={styles.previewLabel}>{t('lpPreview')}</span>
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
          {t('lpOpen')}
        </a>
        {onClose && (
          <button className={styles.closePreviewBtn} onClick={onClose} title={t('lpClosePreview')}>
            ✕
          </button>
        )}
      </div>
      <div className={styles.previewFrame}>
        <div className={styles.previewFrameInner} style={{ width: deviceWidth }}>
          <iframe
            ref={iframeRef}
            src={src}
            className={styles.previewIframe}
            style={{ height: iframeHeight }}
            title="Preview"
            loading="eager"
            onLoad={() => setReady(true)}
          />
        </div>
      </div>
    </div>
  )
}
