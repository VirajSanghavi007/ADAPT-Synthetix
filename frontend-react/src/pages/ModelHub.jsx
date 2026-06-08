import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Play, RefreshCw } from 'lucide-react'
import {
  getHealth, getTtsStatus, getLoraStatus, getLoraExpertsStatus,
  getDatasetStats, getModelInfo, getTrainingStatus, triggerTraining,
} from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { LoadingOverlay } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'

function Label({ children }) {
  return (
    <div style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function ModelRow({ name, provider, task, loaded, accent, description, details }) {
  const c = accent || C.teal
  return (
    <div style={{ display: 'flex', gap: 20, padding: '20px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{name}</span>
          <span style={{ fontSize: 9, color: C.textMuted }}>{provider} · {task}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: loaded ? C.forest : C.clay, marginLeft: 'auto' }}>
            {loaded ? <CheckCircle size={10} /> : <XCircle size={10} />}
            {loaded ? 'loaded' : 'not loaded'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6 }}>{description}</div>
      </div>
      {details && (
        <div style={{ width: 180, flexShrink: 0, borderLeft: `1px solid ${C.border}`, paddingLeft: 20 }}>
          {Object.entries(details).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 4 }}>
              <span style={{ color: C.textMuted }}>{k}</span>
              <span style={{ color: C.textSecondary }}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExpertRow({ type, status, accent }) {
  const exists = status?.exists
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: accent, width: 90, textTransform: 'capitalize' }}>{type}</span>
      <span style={{ fontSize: 10, color: C.textMuted, flex: 1 }}>AdaLoRA · dynamic rank</span>
      {status?.path && <span className="truncate" style={{ fontSize: 8, color: C.textDim, maxWidth: 200 }}>{status.path}</span>}
      <Badge label={exists ? 'trained' : 'untrained'} preset={exists ? 'clean' : 'stable'} dot />
    </div>
  )
}

const EXPERT_ACCENTS = { noise: C.amber, accent: C.lavender, pronunciation: C.clay }
const ERROR_TYPES    = ['all', 'noise', 'accent', 'pronunciation']

export default function ModelHub() {
  const qc = useQueryClient()

  const { data: health }  = useQuery({ queryKey: ['health'],              queryFn: getHealth })
  const { data: tts }     = useQuery({ queryKey: ['tts_status'],          queryFn: getTtsStatus,        refetchInterval: 60_000 })
  const { data: lora, isLoading: loraL } = useQuery({ queryKey: ['lora_status'], queryFn: getLoraStatus, refetchInterval: 30_000 })
  const { data: experts } = useQuery({ queryKey: ['lora_experts_status'], queryFn: getLoraExpertsStatus, refetchInterval: 30_000 })
  const { data: dataset } = useQuery({ queryKey: ['dataset_stats'],       queryFn: getDatasetStats,     refetchInterval: 30_000 })
  const { data: modelInfo }= useQuery({ queryKey: ['model_info'],         queryFn: getModelInfo,        refetchInterval: 60_000 })

  const { data: training } = useQuery({
    queryKey:       ['training_status'],
    queryFn:        getTrainingStatus,
    refetchInterval: (data) => data?.state === 'running' ? 3_000 : 30_000,
  })

  const [trainErrorType, setTrainErrorType] = useState('all')
  const [trainEpochs, setTrainEpochs]       = useState(3)
  const [trainError, setTrainError]         = useState(null)

  const trainMutation = useMutation({
    mutationFn: () => triggerTraining(trainErrorType === 'all' ? null : trainErrorType, trainEpochs),
    onSuccess: () => {
      setTrainError(null)
      qc.invalidateQueries({ queryKey: ['training_status'] })
    },
    onError: (err) => setTrainError(err.message || 'Failed to start training'),
  })

  const isRunning  = training?.state === 'running'
  const expertList = experts ? Object.entries(experts) : [['noise', {}], ['accent', {}], ['pronunciation', {}]]
  const trained    = expertList.filter(([, s]) => s?.exists).length

  // Live model names from /model_info
  const asrBackend = modelInfo?.asr?.backend ?? 'whisper'
  const asrModel   = modelInfo?.asr?.model ?? health?.asr ?? 'openai/whisper-small'
  const ttsModel   = modelInfo?.tts?.model ?? tts?.model  ?? 'suno/bark'
  const asrShort   = asrBackend === 'whisper' ? 'Whisper' : 'Wav2Vec2'

  return (
    <div style={{ display: 'grid', gap: 40, maxWidth: 1000 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderBottom: `1px solid ${C.border}`, paddingBottom: 28 }}>
        {[
          { label: 'ASR backend',   value: asrShort,       sub: asrModel.split('/').pop() },
          { label: 'TTS model',     value: 'Bark',         sub: ttsModel.split('/').pop() },
          { label: 'LoRA experts',  value: `${trained}/3`, sub: 'AdaLoRA adaptive rank' },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '0 28px 0 0', borderRight: i < 2 ? `1px solid ${C.border}` : 'none', marginRight: i < 2 ? 28 : 0 }}>
            <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, lineHeight: 1.1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 9, color: C.textMuted, wordBreak: 'break-all' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Core models */}
      <div>
        <Label>Core models</Label>
        <ModelRow
          name={asrModel}
          provider={asrBackend === 'whisper' ? 'OpenAI' : 'Meta AI'}
          task="ASR"
          loaded={!!health?.asr}
          accent={C.teal}
          description={
            asrBackend === 'whisper'
              ? 'Encoder-decoder transformer trained on 680K hours of multilingual speech. Robust to noise and accents. Medical domain vocabulary injected via initial_prompt for improved transcription accuracy.'
              : 'Self-supervised contrastive pre-training on 960h LibriSpeech. CTC decoding with per-frame confidence extraction and token-level uncertainty (Rumberg et al. 2023).'
          }
          details={{
            Backend:      asrBackend,
            Denoising:    modelInfo?.asr?.denoising ? 'on' : 'off',
            Language:     modelInfo?.asr?.language ?? 'en',
            SR:           '16 kHz',
          }}
        />
        <ModelRow
          name={ttsModel}
          provider="Suno AI"
          task="TTS"
          loaded={tts?.available}
          accent={C.lavender}
          description="GPT-style transformer for neural TTS. Used for phoneme-targeted remediation audio — synthesising target pronunciations for closed-loop feedback."
          details={{ Output: '24 kHz WAV', Format: 'int16' }}
        />
      </div>

      {/* Training panel */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
          <Label>Fine-tune LoRA adapters</Label>
          {lora?.last_trained && (
            <span style={{ fontSize: 9, color: C.textMuted }}>last trained {lora.last_trained?.slice(0, 16)}</span>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6 }}>Error type</div>
            <select
              value={trainErrorType}
              onChange={(e) => setTrainErrorType(e.target.value)}
              disabled={isRunning || trainMutation.isPending}
              style={{
                background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6,
                color: C.textPrimary, fontSize: 11, padding: '6px 10px', cursor: 'pointer',
              }}
            >
              {ERROR_TYPES.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6 }}>Epochs</div>
            <input
              type="number" min={1} max={20} value={trainEpochs}
              onChange={(e) => setTrainEpochs(Math.max(1, Math.min(20, Number(e.target.value))))}
              disabled={isRunning || trainMutation.isPending}
              style={{
                width: 64, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6,
                color: C.textPrimary, fontSize: 11, padding: '6px 10px', textAlign: 'center',
              }}
            />
          </div>

          <button
            onClick={() => trainMutation.mutate()}
            disabled={isRunning || trainMutation.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px',
              background: isRunning ? C.surfaceAlt : C.teal, color: isRunning ? C.textMuted : '#fff',
              border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s', opacity: isRunning || trainMutation.isPending ? 0.6 : 1,
            }}
          >
            {isRunning ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />}
            {isRunning ? 'Training…' : trainMutation.isPending ? 'Starting…' : 'Train'}
          </button>
        </div>

        {/* Progress bar (visible when running or recently completed) */}
        {training && training.state !== 'idle' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: C.textSecondary }}>
                {training.state === 'running' ? 'Training in progress…'
                  : training.state === 'error' ? 'Training failed'
                  : 'Training complete'}
              </span>
              <span style={{ fontSize: 10, color: C.textMuted }}>{training.progress}%</span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
              <div style={{
                height: '100%', borderRadius: 2, transition: 'width 0.4s ease',
                width: `${training.progress}%`,
                background: training.state === 'error' ? C.clay : training.state === 'running' ? C.teal : C.forest,
              }} />
            </div>
            {training.message && (
              <div style={{ fontSize: 9, color: C.textMuted, marginTop: 6 }}>{training.message}</div>
            )}
          </div>
        )}

        {trainError && (
          <div style={{ marginTop: 12, fontSize: 10, color: C.clay }}>{trainError}</div>
        )}
      </div>

      {/* LoRA expert adapters */}
      <div>
        <Label>LoRA expert router</Label>
        {loraL ? <LoadingOverlay /> : expertList.map(([type, status]) => (
          <ExpertRow key={type} type={type} status={status} accent={EXPERT_ACCENTS[type] || C.teal} />
        ))}
        {lora?.training_logs?.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 10, color: C.textSecondary, lineHeight: 1.8 }}>
            {lora.training_logs.slice(-3).map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <span style={{ color: C.textDim }}>[{i + 1}]</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dataset */}
      {dataset && (
        <div>
          <Label>Dataset statistics</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 16 }}>
            {Object.entries(dataset).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
              <div key={k} style={{ borderTop: `2px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 8, color: C.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
