import { useState } from 'react'
import type { ThemeName } from '../state/useSettings'
import type { MusicFontName } from '../render/fonts'

interface TopBarProps {
  fileName: string
  onRename: (name: string) => void
  theme: ThemeName
  onToggleTheme: () => void
  musicFont: MusicFontName
  onSetFont: (f: MusicFontName) => void
  onNewScore: () => void
  onExportXML: () => void
  onExportMIDI: () => void
  onExportWav: () => void
  onExportMp3: () => void
  audioBusy: boolean
  onImportXML: () => void
  onOpenManager: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  eraser: boolean
  onToggleEraser: () => void
}

const FONTS: MusicFontName[] = ['Bravura', 'Leland', 'Petaluma']

export function TopBar({
  fileName,
  onRename,
  theme,
  onToggleTheme,
  musicFont,
  onSetFont,
  onNewScore,
  onExportXML,
  onExportMIDI,
  onExportWav,
  onExportMp3,
  audioBusy,
  onImportXML,
  onOpenManager,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  eraser,
  onToggleEraser,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(fileName)

  function commitRename() {
    const name = draft.trim() || fileName
    onRename(name)
    setEditing(false)
  }

  return (
    <header className="topbar">
      <button
        className="icon-btn"
        aria-label="メニュー"
        onClick={() => setMenuOpen((v) => !v)}
      >
        ☰
      </button>

      <div className="topbar-title">
        <span className="app-name">NamaComp:</span>
        {editing ? (
          <input
            className="filename-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setDraft(fileName)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            className="filename"
            onClick={() => {
              setDraft(fileName)
              setEditing(true)
            }}
          >
            {fileName}
          </button>
        )}
      </div>

      <div className="topbar-actions">
        <button
          className={`icon-btn eraser-toggle ${eraser ? 'on' : ''}`}
          aria-label="消しゴム"
          aria-pressed={eraser}
          title="消しゴム: 音符をタップで削除"
          onClick={onToggleEraser}
        >
          ⌫
        </button>
        <button
          className="icon-btn"
          aria-label="元に戻す"
          disabled={!canUndo}
          onClick={onUndo}
        >
          ↩
        </button>
        <button
          className="icon-btn"
          aria-label="やり直し"
          disabled={!canRedo}
          onClick={onRedo}
        >
          ↪
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="menu">
            <button
              onClick={() => {
                onNewScore()
                setMenuOpen(false)
              }}
            >
              新規スコア
            </button>
            <button
              onClick={() => {
                onOpenManager()
                setMenuOpen(false)
              }}
            >
              楽譜マネージャー（編成）
            </button>
            <button
              onClick={() => {
                onImportXML()
                setMenuOpen(false)
              }}
            >
              MusicXML読み込み
            </button>
            <button
              onClick={() => {
                onExportXML()
                setMenuOpen(false)
              }}
            >
              MusicXML書き出し
            </button>
            <button
              onClick={() => {
                onExportMIDI()
                setMenuOpen(false)
              }}
            >
              MIDI書き出し
            </button>
            <button
              disabled={audioBusy}
              onClick={() => {
                onExportWav()
                setMenuOpen(false)
              }}
            >
              WAV書き出し{audioBusy ? '…' : ''}
            </button>
            <button
              disabled={audioBusy}
              onClick={() => {
                onExportMp3()
                setMenuOpen(false)
              }}
            >
              mp3書き出し{audioBusy ? '…' : ''}
            </button>
            <button onClick={onToggleTheme}>
              テーマ: {theme === 'light' ? 'ライト' : 'ダーク'}
            </button>
            <div className="menu-group">
              <span className="menu-label">音符フォント</span>
              {FONTS.map((f) => (
                <button
                  key={f}
                  className={f === musicFont ? 'active' : ''}
                  onClick={() => onSetFont(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </nav>
        </>
      )}
    </header>
  )
}
