import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { TagFields, QueueEntry, TagAction, ParsedPossession, ShooterDesignationLists, Clip } from '../lib/types'
import { createLocalAdapter } from '../lib/data'
import { VideoPane } from './tagger/VideoPane'
import { ControlsBar } from './tagger/ControlsBar'
import { PbpPane } from './tagger/PbpPane'
import { GameInfoBar } from './tagger/GameInfoBar'
import { TagsPane } from './tagger/TagsPane'
import { QueueDrawer } from './tagger/QueueDrawer'

const STORAGE_KEY = 'ou_clips_v1'
const TAGGER_STATE_KEY = 'ou_tagger_state_v1'

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const parseTime = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number)
  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 3600 + m * 60 + s
  }
  return 0
}

const toActionField = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const createEmptyAction = (): TagAction => ({
  phase: '',
  type: '',
  coverage: '',
  help: '',
  breakdown: '',
  communication: '',
  outcome: '',
})

const createDefaultDesignationLists = (): ShooterDesignationLists => ({
  bluePerimeter: '',
  bluePost: '',
  green: '',
})

const createDefaultFields = (): TagFields => ({
  gameNum: '1',
  gameLocation: '',
  opponent: '',
  gameScore: '',
  quarter: '1',
  possession: '1',
  situation: '',
  offFormation: '',
  playName: '',
  scoutTag: '',
  playTrigger: '',
  actionTrigger: '',
  coverage: '',
  defDisruption: '',
  defBreakdown: '',
  playResult: '',
  paintTouches: '',
  shooterDesignation: '',
  shotLocation: '',
  shotContest: '',
  reboundOutcome: '',
  points: '0',
  notes: '',
  hasShot: '',
  shotX: '',
  shotY: '',
  shotResult: '',
  playerDesignation: '',
})

const normalizeAction = (action?: Partial<TagAction>): TagAction => ({
  phase: toActionField(action?.phase),
  type: toActionField(action?.type),
  coverage: toActionField(action?.coverage),
  help: toActionField(action?.help),
  breakdown: toActionField(action?.breakdown),
  communication: toActionField(action?.communication),
  outcome: toActionField(action?.outcome),
})

const hasActionValue = (action: TagAction) =>
  Boolean(
    action.phase ||
      action.type ||
      action.coverage ||
      action.help ||
      action.breakdown ||
      action.communication ||
      action.outcome,
  )

const normalizeActionsForSave = (list: TagAction[]): TagAction[] => {
  if (!Array.isArray(list)) return []
  return list.map((action) => normalizeAction(action)).filter(hasActionValue)
}

const restoreActionsState = (raw: unknown): TagAction[] => {
  if (!Array.isArray(raw) || !raw.length) {
    return [createEmptyAction()]
  }
  const normalized = raw.map((action) => normalizeAction(action as Partial<TagAction>))
  return normalized.length ? normalized : [createEmptyAction()]
}

const ReactTaggerNative = () => {
  const location = useLocation()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const adapterRef = useRef(createLocalAdapter())
  const savedTimeRef = useRef<number>(0)

  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [currentVideoFile, setCurrentVideoFile] = useState<File | null>(null)
  const [currentVideoPath, setCurrentVideoPath] = useState<string>('')

  const [inTime, setInTime] = useState('')
  const [outTime, setOutTime] = useState('')
  const [actions, setActions] = useState<TagAction[]>([createEmptyAction()])
  const [isSaving, setIsSaving] = useState(false)

  const [fields, setFields] = useState<TagFields>(() => createDefaultFields())

  const [clips, setClips] = useState<QueueEntry[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pbpText, setPbpText] = useState('')
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [savedVideoTime, setSavedVideoTime] = useState<number>(0)
  const [pbpPossessions, setPbpPossessions] = useState<ParsedPossession[]>([])
  const [designationLists, setDesignationLists] = useState<ShooterDesignationLists>(() => createDefaultDesignationLists())
  const [mismatchWarning, setMismatchWarning] = useState<string | null>(null)
  const [editingExistingClip, setEditingExistingClip] = useState<{
    filename: string;
    path: string;
    originalInTime: string;
    originalOutTime: string;
    sourceVideo: string
  } | null>(null)

  // Load clips from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setClips(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to load clips from localStorage:', err)
    }
  }, [])

  // Save clips to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clips))
    } catch (err) {
      console.error('Failed to save clips to localStorage:', err)
    }
  }, [clips])

  // Load tagger state from localStorage on mount OR from route state if editing
  useEffect(() => {
    try {
      // Check if we're editing a clip from the detail page
      const editClip = (location.state as any)?.editClip as Clip | undefined
      if (editClip) {
        console.log('✏️ Loading clip for editing:', editClip)

        // Load the video
        if (editClip.videoUrl) {
          console.log('✏️ Loading video:', editClip.videoUrl)
          setVideoSrc(editClip.videoUrl)

          // Extract the filename from the video URL for the path
          // videoUrl is like "/legacy/Clips/G1_Q1_P1_belmont_timestamp.mp4"
          const filename = editClip.videoUrl.split('/').pop() || editClip.filename || ''
          if (filename) {
            // Don't set currentVideoPath to the extracted clip - we need the original game video
            // If we have sourceVideo, use that; otherwise user will need to load the game video manually
            if (editClip.sourceVideo) {
              setCurrentVideoPath(editClip.sourceVideo)
              console.log('✏️ Loaded source video for editing:', editClip.sourceVideo)
            } else {
              console.warn('⚠️ This clip does not have a source video tracked. To change IN/OUT times, please load the original game video first.')
            }

            // Mark that we're editing an existing clip and store original times
            const origInTime = editClip.videoStart !== undefined && editClip.videoStart !== null
              ? formatTime(editClip.videoStart)
              : '00:00'
            const origOutTime = editClip.videoEnd !== undefined && editClip.videoEnd !== null
              ? formatTime(editClip.videoEnd)
              : '00:00'

            setEditingExistingClip({
              filename: filename,
              path: editClip.path || '',
              originalInTime: origInTime,
              originalOutTime: origOutTime,
              sourceVideo: editClip.sourceVideo || ''
            })
          }
        }

        // Populate fields from clip
        setFields({
          gameNum: String(editClip.gameNumber || editClip.gameId || ''),
          gameLocation: editClip.location || editClip.locationDisplay || editClip.gameLocation || '',
          opponent: editClip.opponent || '',
          gameScore: editClip.gameScore || '',
          quarter: String(editClip.quarter || ''),
          possession: String(editClip.possession || ''),
          situation: editClip.situation || '',
          offFormation: editClip.formation || '',
          playName: editClip.playName || '',
          scoutTag: editClip.scoutCoverage || '',
          playTrigger: editClip.playTrigger || '',
          actionTrigger: '',
          coverage: editClip.coverage || '',
          defDisruption: editClip.disruption || '',
          defBreakdown: editClip.breakdown || '',
          playResult: editClip.playResult || editClip.possessionResult || '',
          paintTouches: editClip.paintTouches || '',
          shooterDesignation: editClip.shooterDesignation || '',
          shotLocation: editClip.shotLocation || '',
          shotContest: editClip.shotContest || '',
          reboundOutcome: editClip.rebound || '',
          points: String(editClip.points || 0),
          notes: editClip.notes || '',
          hasShot: editClip.hasShot ? 'Yes' : 'No',
          shotX: editClip.shotX ? String(editClip.shotX) : '',
          shotY: editClip.shotY ? String(editClip.shotY) : '',
          shotResult: editClip.shotResult || '',
          playerDesignation: editClip.playerDesignation || '',
        })

        // Set IN/OUT times from videoStart/videoEnd if available
        if (editClip.videoStart !== undefined && editClip.videoStart !== null) {
          setInTime(formatTime(editClip.videoStart))
        }
        if (editClip.videoEnd !== undefined && editClip.videoEnd !== null) {
          setOutTime(formatTime(editClip.videoEnd))
        }

        // Restore actions
        if (editClip.actions && editClip.actions.length > 0) {
          setActions(editClip.actions)
        }

        // Clear the location state so refreshing doesn't reload the clip
        window.history.replaceState({}, document.title)
        return
      }

      const stored = localStorage.getItem(TAGGER_STATE_KEY)
      console.log('🔵 Loading tagger state:', stored)
      if (stored) {
        const parsed = JSON.parse(stored)
        console.log('🔵 Parsed state:', parsed)
        if (parsed.videoPath) {
          console.log('🔵 Restoring videoPath:', parsed.videoPath)
          setCurrentVideoPath(parsed.videoPath)
        }
        if (parsed.videoSrc) {
          console.log('🔵 Restoring videoSrc:', parsed.videoSrc.substring(0, 50))
          setVideoSrc(parsed.videoSrc)
        } else if (parsed.videoPath && !parsed.videoPath.startsWith('blob:')) {
          // Fallback: construct server URL from path if it's not a blob
          console.log('🔵 Constructing server URL from path')
          setVideoSrc(`http://localhost:8000/video?path=${encodeURIComponent(parsed.videoPath)}`)
        }
        if (parsed.videoTime !== undefined) {
          console.log('🔵 Restoring videoTime:', parsed.videoTime)
          setSavedVideoTime(parsed.videoTime)
          savedTimeRef.current = parsed.videoTime
        }
        if (parsed.fields) {
          console.log('🔵 Restoring fields:', parsed.fields)
          setFields((prev) => ({
            ...createDefaultFields(),
            ...prev,
            ...parsed.fields,
          }))
        }
        if (parsed.pbpText) {
          console.log('🔵 Restoring pbpText:', parsed.pbpText.substring(0, 50))
          setPbpText(parsed.pbpText)
        }
        if (parsed.inTime !== undefined) {
          console.log('🔵 Restoring inTime:', parsed.inTime)
          setInTime(parsed.inTime)
        }
        if (parsed.outTime !== undefined) {
          console.log('🔵 Restoring outTime:', parsed.outTime)
          setOutTime(parsed.outTime)
        }
        if (parsed.actions !== undefined) {
          console.log('🔵 Restoring actions:', parsed.actions)
          setActions(restoreActionsState(parsed.actions))
        }
        if (parsed.designationLists) {
          setDesignationLists({
            bluePerimeter: parsed.designationLists.bluePerimeter || '',
            bluePost: parsed.designationLists.bluePost || '',
            green: parsed.designationLists.green || '',
          })
        }
      }
    } catch (err) {
      console.error('Failed to load tagger state from localStorage:', err)
    } finally {
      // Mark initial load as complete to allow saves
      setIsInitialLoad(false)
    }
  }, [location.state])

  // Save tagger state to localStorage when it changes
  useEffect(() => {
    // Skip saving during initial load to prevent race condition
    if (isInitialLoad) {
      console.log('⏭️ Skipping save during initial load')
      return
    }

    const saveState = () => {
      try {
        const currentTime = videoRef.current?.currentTime || 0
        const state = {
          videoPath: currentVideoPath,
          videoSrc: videoSrc,
          videoTime: currentTime,
          fields,
          pbpText,
          inTime,
          outTime,
          actions,
          designationLists,
        }
        console.log('🟢 Saving tagger state:', { videoPath: currentVideoPath, videoSrc: videoSrc?.substring(0, 50), videoTime: currentTime, fieldsCount: Object.keys(fields).length, pbpTextLength: pbpText.length, inTime, outTime })
        localStorage.setItem(TAGGER_STATE_KEY, JSON.stringify(state))
      } catch (err) {
        console.error('Failed to save tagger state to localStorage:', err)
      }
    }

    // Save immediately when dependencies change
    saveState()

    // Also save periodically (every 2 seconds) to capture video time changes
    const interval = setInterval(saveState, 2000)

    return () => {
      clearInterval(interval)
      // Save one last time on cleanup
      saveState()
    }
  }, [currentVideoPath, videoSrc, fields, pbpText, inTime, outTime, actions, designationLists, isInitialLoad])

  useEffect(() => {
    if (!pbpPossessions.length) return
    const currentNumber = Number(fields.possession)
    if (!Number.isFinite(currentNumber) || currentNumber <= 0) return
    const match = pbpPossessions.find((possession) => possession.number === currentNumber)
    if (!match) return
    setFields((prev) => {
      let changed = false
      const next = { ...prev }
      const applyField = (field: keyof TagFields, value: string) => {
        if (prev[field] !== value) {
          next[field] = value
          changed = true
        }
      }

      const applyFieldOrClear = (field: keyof TagFields, value: string | undefined, emptyValue = '') => {
        if (value !== undefined) {
          applyField(field, value)
        } else if (prev[field] !== emptyValue) {
          next[field] = emptyValue
          changed = true
        }
      }

      if (match.playResult) applyField('playResult', match.playResult)
      if (match.points !== undefined) {
        applyField('points', String(match.points))
      } else {
        applyFieldOrClear('points', undefined, '0')
      }
      applyFieldOrClear('reboundOutcome', match.reboundOutcome)
      applyFieldOrClear('hasShot', match.hasShot)
      applyFieldOrClear('shotResult', match.shotResult)
      applyFieldOrClear('shooterDesignation', match.shooterDesignation)
      applyFieldOrClear('playerDesignation', match.playerDesignation)

      return changed ? next : prev
    })
  }, [fields.possession, pbpPossessions])

  useEffect(() => {
    if (!pbpPossessions.length) {
      setMismatchWarning(null)
      return
    }
    const currentNumber = Number(fields.possession)
    if (!Number.isFinite(currentNumber) || currentNumber <= 0) {
      setMismatchWarning(null)
      return
    }
    const match = pbpPossessions.find((possession) => possession.number === currentNumber)
    if (!match) {
      setMismatchWarning(null)
      return
    }

    const fieldPoints = fields.points !== undefined && fields.points !== '' ? Number(fields.points) : NaN
    const numericPoints = Number.isFinite(fieldPoints)
      ? fieldPoints
      : typeof match.points === 'number'
        ? match.points
        : Number(match.points ?? 0)
    const normalizedResult = (fields.playResult || match.playResult || '').toLowerCase()
    const indicatesScore =
      normalizedResult.includes('made fg') || normalizedResult.includes('shooting foul') || normalizedResult.includes('made 3') || normalizedResult.includes('made 2')
    const indicatesNoScore =
      normalizedResult.includes('missed') ||
      normalizedResult.includes('turnover') ||
      normalizedResult.includes('dead-ball') ||
      normalizedResult.includes('dead-ball') ||
      normalizedResult.includes('deflection') ||
      normalizedResult.includes('reach') ||
      normalizedResult.includes('loose') ||
      normalizedResult.includes('steal')

    let warning: string | null = null
    if (indicatesScore && numericPoints === 0) {
      warning = `Possession ${match.number}: Play result shows a score but Points = 0.`
    } else if (indicatesNoScore && numericPoints > 0) {
      warning = `Possession ${match.number}: Points > 0 but play result shows a stop.`
    } else {
      warning = null
    }
    setMismatchWarning(warning)
  }, [fields.points, fields.playResult, fields.possession, pbpPossessions])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      switch (e.key.toLowerCase()) {
        case 'i':
          handleMarkIn()
          break
        case 'o':
          handleMarkOut()
          break
        case 's':
          handleSave()
          break
        case '1':
          if (videoRef.current) videoRef.current.playbackRate = 0.5
          break
        case '2':
          if (videoRef.current) videoRef.current.playbackRate = 1
          break
        case '3':
          if (videoRef.current) videoRef.current.playbackRate = 2
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [fields, inTime, outTime])

  const handleLoadVideo = () => {
    fileInputRef.current?.click()
  }

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCurrentVideoFile(file)
    setCurrentVideoPath(file.name)

    const url = URL.createObjectURL(file)
    setVideoSrc(url)
  }

  const handleVideoLoaded = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video

    // Restore saved video time if available
    if (savedTimeRef.current > 0) {
      console.log('🔵 Seeking to saved time in handleVideoLoaded:', savedTimeRef.current)
      video.currentTime = savedTimeRef.current
      savedTimeRef.current = 0 // Reset so we don't keep seeking
    }
  }, [])

  const handleMarkIn = () => {
    if (videoRef.current && !isNaN(videoRef.current.currentTime)) {
      setInTime(formatTime(videoRef.current.currentTime))
    }
  }

  const handleMarkOut = () => {
    if (videoRef.current && !isNaN(videoRef.current.currentTime)) {
      setOutTime(formatTime(videoRef.current.currentTime))
    }
  }

  const handleFieldChange = (field: keyof TagFields, value: string) => {
    console.log(`🐛 handleFieldChange called - field: "${field}", value: "${value}"`)
    setFields((prev) => {
      const updated = { ...prev, [field]: value }
      console.log(`🐛 Updated fields:`, { [field]: updated[field] })
      return updated
    })
  }

  const handleActionChange = (index: number, key: keyof TagAction, value: string) => {
    setActions((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        [key]: value,
      }
      return next
    })
  }

  const handleAddAction = () => {
    setActions((prev) => [...prev, createEmptyAction()])
  }

  const handleRemoveAction = (index: number) => {
    setActions((prev) => {
      if (prev.length <= 1) {
        return [createEmptyAction()]
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSave = async () => {
    if (!inTime || !outTime) {
      alert('Mark IN and OUT first')
      return
    }

    if (isSaving) {
      return // Prevent double-saves
    }

    // Check for duplicate possession
    const duplicate = clips.find(
      (c) =>
        c['Game #'] === fields.gameNum &&
        c.Opponent === fields.opponent &&
        c.Quarter === fields.quarter &&
        c['Possession #'] === fields.possession
    )

    if (duplicate) {
      const confirmOverwrite = confirm(
        `WARNING: Duplicate Possession Detected!\n\nGame ${fields.gameNum} vs ${fields.opponent}, Q${fields.quarter} P${fields.possession} already exists in the queue.\n\nClick OK to save anyway (will create duplicate)\nClick Cancel to go back and change the possession number`
      )
      if (!confirmOverwrite) return
    }

    setIsSaving(true)

    try {
      const normalizedActions = normalizeActionsForSave(actions)
      const opponentRaw = fields.opponent.trim()
      const gameNum = parseInt(fields.gameNum, 10) || 0
      const slug = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')

      const opponentSlug = slug(opponentRaw)
      const gameId = `G${gameNum}_${opponentSlug}`
      const clipId = `${gameId}_Q${fields.quarter}P${fields.possession}_${Date.now().toString().slice(-6)}`

      // Build queue entry for local display
      const clipData: QueueEntry = {
        __clipId: clipId,
        __gameId: gameId,
        __opponent: opponentRaw,
        __selected: true,
        __actions: normalizedActions,
        'Game #': fields.gameNum,
        Location: fields.gameLocation,
        Opponent: fields.opponent,
        'Game Score': fields.gameScore,
        Quarter: fields.quarter,
        'Possession #': fields.possession,
        Situation: fields.situation,
        'Offensive Formation': fields.offFormation,
        'Play Name': fields.playName,
        'Covered in Scout?': fields.scoutTag,
        'Play Trigger': fields.playTrigger,
        'Action Trigger': fields.actionTrigger,
        'Defensive Coverage': fields.coverage,
        'Defensive Disruption': fields.defDisruption,
        'Defensive Breakdown': fields.defBreakdown,
        'Play Result': fields.playResult,
        'Paint Touches': fields.paintTouches,
        'Shooter Designation': fields.shooterDesignation,
        'Shot Location': fields.shotLocation,
        'Shot Contest': fields.shotContest,
        'Rebound Outcome': fields.reboundOutcome,
        'Has Shot': fields.hasShot || 'No',
        'Shot X': fields.shotX || '',
        'Shot Y': fields.shotY || '',
        'Shot Result': fields.shotResult || '',
        Points: fields.points,
        Notes: fields.notes,
        'Start Time': inTime,
        'End Time': outTime,
        q: fields.quarter,
        p: fields.possession,
        start: inTime,
        end: outTime,
        play: fields.playName,
        situation: fields.situation,
        shooter: fields.shooterDesignation,
        res: fields.playResult,
      }

      // Build API payload matching database schema
      console.log('🐛 DEBUG - Fields at save time:', {
        offFormation: fields.offFormation,
        coverage: fields.coverage,
        defDisruption: fields.defDisruption,
      })

      const apiPayload = {
        id: clipId,
        filename: currentVideoPath || 'unknown.mp4',
        path: currentVideoPath || '',
        source_video: editingExistingClip?.sourceVideo || currentVideoPath || '', // Preserve or track original game video
        game_id: gameNum,
        canonical_game_id: gameId,
        canonical_clip_id: clipId,
        opponent: opponentRaw,
        opponent_slug: opponentSlug,
        location: fields.gameLocation || '',
        game_score: fields.gameScore || '',
        quarter: parseInt(fields.quarter, 10) || 1,
        possession: parseInt(fields.possession, 10) || 1,
        situation: fields.situation || '',
        formation: fields.offFormation || '',
        play_name: fields.playName || '',
        scout_coverage: fields.scoutTag || '',
        play_trigger: fields.playTrigger || '',
        action_trigger: fields.actionTrigger || '',
        coverage: fields.coverage || '',
        disruption: fields.defDisruption || '',
        breakdown: fields.defBreakdown || '',
        result: fields.playResult || '',
        paint_touch: fields.paintTouches || '',
        shooter: fields.shooterDesignation || '',
        shot_location: fields.shotLocation || '',
        contest: fields.shotContest || '',
        rebound: fields.reboundOutcome || '',
        points: parseInt(fields.points, 10) || 0,
        has_shot: fields.hasShot || 'No',
        shot_x: fields.shotX || '',
        shot_y: fields.shotY || '',
        shot_result: fields.shotResult || '',
        player_designation: fields.playerDesignation || '',
        notes: fields.notes || '',
        start_time: inTime,
        end_time: outTime,
        actions: normalizedActions,
      }

      // Extract the actual video clip using FFmpeg (skip if editing existing clip with unchanged times)
      const timesChanged = editingExistingClip &&
        (inTime !== editingExistingClip.originalInTime || outTime !== editingExistingClip.originalOutTime)

      if (editingExistingClip && !timesChanged) {
        // We're editing an existing clip and the IN/OUT times haven't changed, so reuse the existing video file
        console.log('✏️ Editing existing clip with unchanged times, reusing existing file:', editingExistingClip.filename)
        apiPayload.filename = editingExistingClip.filename
        apiPayload.path = editingExistingClip.path
        apiPayload.source_video = editingExistingClip.sourceVideo // Preserve source video
        clipData.filename = editingExistingClip.filename

        // Clear the editing flag after save
        setEditingExistingClip(null)
      } else {
        // New clip OR editing with changed times - extract video
        let videoPathToExtract = currentVideoPath
        if (timesChanged) {
          console.log('✏️ IN/OUT times changed, extracting new clip:', {
            original: `${editingExistingClip?.originalInTime} - ${editingExistingClip?.originalOutTime}`,
            new: `${inTime} - ${outTime}`,
            sourceVideo: editingExistingClip?.sourceVideo
          })
          // Use the source video for extraction, not the current video path
          if (editingExistingClip?.sourceVideo) {
            videoPathToExtract = editingExistingClip.sourceVideo
            console.log('✏️ Using source video for re-extraction:', videoPathToExtract)
          }
          // Clear the editing flag since we're extracting a new clip
          setEditingExistingClip(null)
        }
        try {
          // First, set the video path in the extractor service (use source video if editing)
          if (videoPathToExtract) {
            console.log('🎬 Setting video path for extraction:', videoPathToExtract)
            const setVideoResponse = await fetch('http://127.0.0.1:5002/set_video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ video_path: videoPathToExtract })
            })

            // If the video path couldn't be auto-located, prompt user for the full path
            if (!setVideoResponse.ok) {
              const errorData = await setVideoResponse.json()
              console.warn('⚠️ Auto-locate failed:', errorData.error)

              const userPath = prompt(
                `The video file "${videoPathToExtract}" couldn't be found automatically.\n\n` +
                `Please enter the full path to the video file on your computer:\n` +
                `(e.g., /Users/yourname/Desktop/Defense/Videos/Game1.mp4)`
              )

              if (!userPath || !userPath.trim()) {
                throw new Error('Video path required for extraction')
              }

              // Try setting the video with the user-provided path
              const manualSetResponse = await fetch('http://127.0.0.1:5002/set_video_manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_path: userPath.trim() })
              })

              if (!manualSetResponse.ok) {
                const manualError = await manualSetResponse.json()
                throw new Error(manualError.error || 'Failed to set video path')
              }

              // Update the videoPathToExtract with the user-provided path for next time
              console.log('✅ Video path set manually:', userPath.trim())
            }
          }

          // Now extract the clip
          const extractResponse = await fetch('http://127.0.0.1:5002/extract_clip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clipData)
          })

          if (!extractResponse.ok) {
            const errorData = await extractResponse.json()
            throw new Error(errorData.error || 'Failed to extract video clip')
          }

          const extractResult = await extractResponse.json()
          console.log('✅ Video clip extracted:', extractResult.filename)

          // Update the clip data with the extracted video filename
          if (extractResult.filename) {
            apiPayload.filename = extractResult.filename
            apiPayload.path = extractResult.path || ''
            clipData.filename = extractResult.filename
          }
        } catch (extractError) {
          console.error('⚠️ Failed to extract video clip:', extractError)
          alert(`Warning: Could not extract video clip. Make sure clip_extractor.py is running on port 5002.\n\n${extractError}`)
        }
      }

      // Save to API
      try {
        await adapterRef.current.saveClip(apiPayload as any)
        console.log('✅ Clip saved to database:', clipId)
      } catch (apiError) {
        console.error('⚠️ Failed to save clip to API:', apiError)
        alert(`Warning: Clip saved locally but failed to save to database.\n\n${apiError}`)
      }

      // Add to local queue
      setClips((prev) => [...prev, clipData])

      // Increment Possession #
      const newPossession = String((parseInt(fields.possession, 10) || 0) + 1)

      // Clear fields (keep Opponent, Quarter, Possession; reset Points to 0)
      setFields((prev) => ({
        ...prev,
        possession: newPossession,
        situation: '',
        offFormation: '',
        playName: '',
        scoutTag: '',
        playTrigger: '',
        actionTrigger: '',
        coverage: '',
        defDisruption: '',
        defBreakdown: '',
        playResult: '',
        paintTouches: '',
        shooterDesignation: '',
        shotLocation: '',
        shotContest: '',
        reboundOutcome: '',
        points: '0',
        notes: '',
        hasShot: 'No',
        shotX: '',
        shotY: '',
        shotResult: '',
        playerDesignation: '',
      }))

      // Clear IN/OUT
      setInTime('')
      setOutTime('')
      setActions([createEmptyAction()])
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditClip = (clip: QueueEntry) => {
    // Populate all fields from the clip
    setFields({
      gameNum: clip['Game #'],
      gameLocation: clip.Location,
      opponent: clip.Opponent,
      gameScore: clip['Game Score'],
      quarter: clip.Quarter,
      possession: clip['Possession #'],
      situation: clip.Situation,
      offFormation: clip['Offensive Formation'],
      playName: clip['Play Name'],
      scoutTag: clip['Covered in Scout?'],
      playTrigger: clip['Play Trigger'],
      actionTrigger: clip['Action Trigger'],
      coverage: clip['Defensive Coverage'],
      defDisruption: clip['Defensive Disruption'],
      defBreakdown: clip['Defensive Breakdown'],
      playResult: clip['Play Result'],
      paintTouches: clip['Paint Touches'],
      shooterDesignation: clip['Shooter Designation'],
      shotLocation: clip['Shot Location'],
      shotContest: clip['Shot Contest'],
      reboundOutcome: clip['Rebound Outcome'],
      points: clip.Points,
      notes: clip.Notes,
      hasShot: clip['Has Shot'],
      shotX: clip['Shot X'],
      shotY: clip['Shot Y'],
      shotResult: clip['Shot Result'],
      playerDesignation: '',
    })

    // Set IN/OUT times
    setInTime(clip['Start Time'])
    setOutTime(clip['End Time'])

    // Restore actions if available
    if (clip.__actions && clip.__actions.length > 0) {
      setActions(clip.__actions)
    } else {
      setActions([createEmptyAction()])
    }

    // Seek video to clip start time
    if (videoRef.current) {
      const parseTime = (timeStr: string): number => {
        const parts = timeStr.split(':').map(Number)
        if (parts.length === 3) {
          const [h, m, s] = parts
          return h * 3600 + m * 60 + s
        }
        return 0
      }
      videoRef.current.currentTime = parseTime(clip.start)
      videoRef.current.pause()
    }
  }

  const handleToggleDrawer = () => {
    setDrawerOpen((prev) => !prev)
  }

  const handleSelectAll = (checked: boolean) => {
    setClips((prev) =>
      prev.map((c) => ({
        ...c,
        __selected: checked,
      }))
    )
  }

  const handleSelectClip = (index: number, checked: boolean) => {
    setClips((prev) =>
      prev.map((c, i) =>
        i === index
          ? {
              ...c,
              __selected: checked,
            }
          : c
      )
    )
  }

  const handleDeleteClip = (index: number) => {
    setClips((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSeekToClip = (timeStr: string) => {
    if (!videoRef.current) return
    const seconds = parseTime(timeStr)
    videoRef.current.currentTime = seconds
    videoRef.current.pause()
  }

  const handleExportCsv = () => {
    if (!clips.length) {
      alert('No clips to export.')
      return
    }

    const ORDER = [
      'Game #',
      'Location',
      'Opponent',
      'Quarter',
      'Possession #',
      'Situation',
      'Offensive Formation',
      'Play Name',
      'Covered in Scout?',
      'Action Trigger',
      'Defensive Coverage',
      'Defensive Disruption',
      'Defensive Breakdown',
      'Play Result',
      'Paint Touches',
      'Shooter Designation',
      'Shot Location',
      'Shot Contest',
      'Rebound Outcome',
      'Points',
      'Notes',
      'Start Time',
      'End Time',
    ]

    const esc = (value: unknown) => {
      const str = value === null || value === undefined ? '' : String(value)
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const maxActions = clips.reduce((max, clip) => Math.max(max, clip.__actions?.length ?? 0), 0)
    const actionHeaders: string[] = []
    for (let i = 1; i <= maxActions; i++) {
      actionHeaders.push(
        `Action${i}_Phase`,
        `Action${i}_Type`,
        `Action${i}_Coverage`,
        `Action${i}_Help`,
        `Action${i}_Breakdown`,
        `Action${i}_Communication`,
        `Action${i}_Outcome`,
      )
    }

    const headers = [...ORDER, ...actionHeaders]

    const rawHeader = headers.map((key) => esc(key)).join(',')
    const rawRows = clips.map((clip) => {
      const base = ORDER.map((key) => esc(clip[key as keyof QueueEntry] ?? ''))
      const actionValues: string[] = []
      for (let i = 0; i < maxActions; i++) {
        const action = clip.__actions?.[i]
        actionValues.push(
          esc(action?.phase ?? ''),
          esc(action?.type ?? ''),
          esc(action?.coverage ?? ''),
          esc(action?.help ?? ''),
          esc(action?.breakdown ?? ''),
          esc(action?.communication ?? ''),
          esc(action?.outcome ?? ''),
        )
      }
      return [...base, ...actionValues]
    })
    const rawCsv = [rawHeader, ...rawRows.map((row) => row.join(','))].join('\r\n')

    const opp = fields.opponent.trim() || 'Opponent'
    const game = fields.gameNum.trim() || 'Game'
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const rawName = `Tagging_raw_${opp}_${game}_${stamp}.csv`.replace(/\s+/g, '_')

    const blob = new Blob(['\ufeff' + rawCsv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = rawName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    alert('Exported CSV file.')
  }

  const handleAddToDashboard = () => {
    // Clips are automatically saved to the database via API, so they'll appear in the dashboard
    const count = clips.filter((c) => c.__selected !== false).length
    if (count === 0) {
      alert('No clips selected. Select clips from the queue first.')
      return
    }
    alert(`${count} clip${count > 1 ? 's' : ''} already saved to the database. They will appear in the Dashboard.`)
  }

  const selectedCount = clips.filter((c) => c.__selected !== false).length

  const handlePossessionsChange = useCallback((possessions: ParsedPossession[]) => {
    setPbpPossessions(possessions)
  }, [])

  const handleDesignationListsChange = useCallback((lists: ShooterDesignationLists) => {
    setDesignationLists(lists)
  }, [])

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoFileChange}
        className="hidden"
      />

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-2 pb-6">
        <div
          className="grid mx-auto"
          style={{
            gridTemplateAreas: '"video pbp" "controls pbp" "gameinfo pbp" "tags tags"',
            gridTemplateColumns: '1fr 370px',
            gridTemplateRows: 'auto minmax(36px, auto) auto auto',
            columnGap: '16px',
            rowGap: '12px',
            minHeight: 'calc(100vh - 64px)',
            paddingBottom: '32px',
            maxWidth: 'calc(100vw - 80px)',
            width: '100%',
          }}
        >
          {/* Video Pane */}
          <section
            className="panel relative flex min-h-0 flex-col self-stretch rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            style={{
              gridArea: 'video',
              height: 'clamp(300px, calc(100vh - 240px), 560px)',
              maxHeight: 'clamp(300px, calc(100vh - 240px), 560px)',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottomWidth: 0,
            }}
          >
            <VideoPane videoSrc={videoSrc} onVideoLoaded={handleVideoLoaded} />
          </section>

          {/* Controls Bar */}
          <section
            style={{
              gridArea: 'controls',
              transform: 'translateY(-15px)',
              zIndex: 10,
              position: 'relative',
              marginBottom: '16px',
            }}
          >
            {mismatchWarning && (
              <div className="mb-2 rounded-md border border-[#ffb347]/40 bg-[#3a1f1f] px-3 py-2 text-xs text-[#ffe0d0]">
                {mismatchWarning}
              </div>
            )}
            <ControlsBar
              videoRef={videoRef.current}
              inTime={inTime}
              outTime={outTime}
              onLoadVideo={handleLoadVideo}
              onMarkIn={handleMarkIn}
              onMarkOut={handleMarkOut}
              onSave={handleSave}
              onInTimeChange={setInTime}
              onOutTimeChange={setOutTime}
            />
          </section>

          {/* PBP Pane */}
          <aside
            className="panel relative flex flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            style={{
              gridArea: 'pbp',
              height: 'calc(clamp(300px, calc(100vh - 240px), 560px) + 140px)',
              maxHeight: 'calc(clamp(300px, calc(100vh - 240px), 560px) + 140px)',
            }}
          >
            <PbpPane
              opponent={fields.opponent}
              pbpText={pbpText}
              onPbpTextChange={setPbpText}
              designationLists={designationLists}
              onDesignationListsChange={handleDesignationListsChange}
              onPossessionsChange={handlePossessionsChange}
              shotX={fields.shotX || ''}
              shotY={fields.shotY || ''}
              shotResult={fields.shotResult || ''}
              playerDesignation={fields.playerDesignation || ''}
              onShotDataChange={(data) => {
                setFields((prev) => ({
                  ...prev,
                  shotX: data.shotX,
                  shotY: data.shotY,
                  shotResult: data.shotResult,
                  playerDesignation: data.playerDesignation,
                  hasShot: data.shotX && data.shotY ? 'Yes' : 'No',
                }))
              }}
              actions={actions}
              onActionChange={handleActionChange}
              onAddAction={handleAddAction}
              onRemoveAction={handleRemoveAction}
            />
          </aside>

          {/* Game Info Bar */}
          <section
            key="game-info-bar"
            style={{
              gridArea: 'gameinfo',
              transform: 'translateY(-30px)',
              zIndex: 10,
              position: 'relative',
              padding: 0,
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            <GameInfoBar fields={fields} onChange={handleFieldChange} />
          </section>

          {/* Tags Pane */}
          <section
            key="tags-pane-v2"
            className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            style={{ gridArea: 'tags', transform: 'translateY(-45px)', zIndex: 10, position: 'relative', padding: 0 }}
          >
            <TagsPane fields={fields} onChange={handleFieldChange} />
          </section>
        </div>
      </main>

      {/* Queue Drawer */}
      <QueueDrawer
        isOpen={drawerOpen}
        clips={clips}
        selectedCount={selectedCount}
        videoRef={videoRef.current}
        onToggle={handleToggleDrawer}
        onSelectAll={handleSelectAll}
        onSelectClip={handleSelectClip}
        onDeleteClip={handleDeleteClip}
        onEditClip={handleEditClip}
        onExportCsv={handleExportCsv}
        onAddToDashboard={handleAddToDashboard}
      />
    </div>
  )
}

export default ReactTaggerNative
