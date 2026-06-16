import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Play, RefreshCw, Download, Database, Cpu, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getHealth, getTtsStatus, getLoraStatus, getLoraExpertsStatus,
  getDatasetStats, getModelInfo, getTrainingStatus, triggerTraining,
  getAvailableDatasets, getDownloadStatus, triggerDatasetDownload,
  getBaseTrainingStatus, triggerBaseTraining,
} from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'

// ── Shared ─────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 14 }}>
      {children}
    </div>
  )
}

function ProgressBar({ pct, state }) {
  const color = state === 'error' ? C.red : state === 'done' ? C.green : C.blue
  return (
    <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 2, transition: 'width 0.4s ease',
        width: `${pct ?? 0}%`, background: color,
      }} />
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
      <span style={{ color: C.textMuted }}>{label}</span>
      <span style={{ color: C.textSecondary }}>{value ?? '—'}</span>
    </div>
  )
}

// ── Dataset download panel ─────────────────────────────────────

function DatasetPanel() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState('medical-synthetic')
  const [expanded, setExpanded] = useState(true)

  const { data: datasets = [] } = useQuery({
    queryKey: ['available_datasets'],
    queryFn:  getAvailableDatasets,
    refetchInterval: 10_000,
  })

  const { data: dlStatus } = useQuery({
    queryKey: ['download_status'],
    queryFn:  getDownloadStatus,
    refetchInterval: (d) => d?.state === 'downloading' || d?.state === 'extracting' || d?.state === 'generating' ? 2_000 : 15_000,
  })

  const dlMutation = useMutation({
    mutationFn: () => triggerDatasetDownload(selected),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['download_status'] }),
  })

  const isActive   = ['downloading', 'extracting', 'generating'].includes(dlStatus?.state)
  const activeDs   = datasets.find((d) => d.name === selected)
  const selectedDs = datasets.find((d) => d.name === selected)

  return (
    <Card>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}
      >
        <Database size={14} color={C.blue} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, flex: 1 }}>Training Datasets</span>
        <span style={{ fontSize: 11, color: C.textMuted }}>{datasets.filter((d) => d.downloaded).length}/{datasets.length} downloaded</span>
        {expanded ? <ChevronDown size={13} color={C.textMuted} /> : <ChevronRight size={13} color={C.textMuted} />}
      </div>

      {expanded && (
        <CardBody style={{ paddingTop: 0 }}>
          {/* Dataset list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {datasets.map((ds) => (
              <div
                key={ds.name}
                onClick={() => setSelected(ds.name)}
                style={{
                  padding: '12px 14px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${selected === ds.name ? C.blue : C.border}`,
                  background: selected === ds.name ? C.blueDim : C.surfaceAlt,
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, flex: 1 }}>{ds.name}</span>
                  {ds.downloaded
                    ? <span style={{ fontSize: 10, color: C.green, display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle size={10} /> {ds.n_samples} samples</span>
                    : <span style={{ fontSize: 10, color: C.textMuted }}>{ds.size_mb > 0 ? `${ds.size_mb} MB` : 'local'}</span>
                  }
                </div>
                <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.5 }}>{ds.description}</div>
              </div>
            ))}
          </div>

          {/* Download controls */}
          {dlStatus && dlStatus.state !== 'idle' && dlStatus.dataset === selected && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.textSecondary }}>{dlStatus.message}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>{dlStatus.progress}%</span>
              </div>
              <ProgressBar pct={dlStatus.progress} state={dlStatus.state} />
              {dlStatus.error && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>{dlStatus.error}</div>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              variant="primary"
              size="sm"
              icon={isActive && dlStatus?.dataset === selected ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={12} />}
              onClick={() => dlMutation.mutate()}
              disabled={isActive || dlMutation.isPending || selectedDs?.downloaded}
            >
              {selectedDs?.downloaded
                ? 'Already downloaded'
                : isActive && dlStatus?.dataset === selected
                  ? 'Downloading…'
                  : `Download ${selected}`}
            </Button>
            {dlMutation.isError && (
              <span style={{ fontSize: 11, color: C.red }}>{dlMutation.error?.message}</span>
            )}
          </div>
        </CardBody>
      )}
    </Card>
  )
}

// ── Base training panel ────────────────────────────────────────

function BaseTrainingPanel() {
  const qc = useQueryClient()
  const [expanded, setExpanded]       = useState(true)
  const [dataset, setDataset]         = useState('medical-synthetic')
  const [epochs, setEpochs]           = useState(3)
  const [maxSamples, setMaxSamples]   = useState(500)

  const { data: datasets = [] } = useQuery({ queryKey: ['available_datasets'], queryFn: getAvailableDatasets })

  const { data: btStatus } = useQuery({
    queryKey: ['base_training_status'],
    queryFn:  getBaseTrainingStatus,
    refetchInterval: (d) => d?.state === 'running' ? 3_000 : 30_000,
  })

  const trainMutation = useMutation({
    mutationFn: () => triggerBaseTraining(dataset, epochs, maxSamples),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['base_training_status'] }),
  })

  const isRunning    = btStatus?.state === 'running'
  const downloadedDs = datasets.filter((d) => d.downloaded)

  return (
    <Card>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}
      >
        <Cpu size={14} color={C.purple} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, flex: 1 }}>Base Model Fine-tuning</span>
        {btStatus?.state === 'done' && <span style={{ fontSize: 11, color: C.green }}>✓ Trained</span>}
        {btStatus?.state === 'running' && <span style={{ fontSize: 11, color: C.blue }}>Running…</span>}
        {expanded ? <ChevronDown size={13} color={C.textMuted} /> : <ChevronRight size={13} color={C.textMuted} />}
      </div>

      {expanded && (
        <CardBody style={{ paddingTop: 0 }}>
          <p style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
            Fine-tune Whisper on a locally downloaded corpus using LoRA adapters.
            The trained adapter is saved to <code className="mono" style={{ fontSize: 11 }}>models/base_finetuned/</code> and
            automatically used for all future transcriptions.
          </p>

          {downloadedDs.length === 0 ? (
            <div style={{ padding: '12px 14px', background: C.amberDim, borderLeft: `3px solid ${C.amber}`, borderRadius: 4, fontSize: 12, color: C.textPrimary, marginBottom: 16 }}>
              Download a dataset above first before running base fine-tuning.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Dataset</div>
                <select
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value)}
                  disabled={isRunning}
                  style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textPrimary, fontSize: 11, padding: '6px 10px' }}
                >
                  {downloadedDs.map((d) => (
                    <option key={d.name} value={d.name}>{d.name} ({d.n_samples} samples)</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Epochs</div>
                <input
                  type="number" min={1} max={20} value={epochs}
                  onChange={(e) => setEpochs(Math.max(1, Math.min(20, Number(e.target.value))))}
                  disabled={isRunning}
                  style={{ width: 64, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textPrimary, fontSize: 11, padding: '6px 10px', textAlign: 'center' }}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Max samples</div>
                <input
                  type="number" min={10} max={10000} step={100} value={maxSamples}
                  onChange={(e) => setMaxSamples(Math.max(10, Number(e.target.value)))}
                  disabled={isRunning}
                  style={{ width: 80, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textPrimary, fontSize: 11, padding: '6px 10px', textAlign: 'center' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button
                  variant="primary"
                  size="sm"
                  icon={isRunning ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={12} />}
                  onClick={() => trainMutation.mutate()}
                  disabled={isRunning || trainMutation.isPending}
                >
                  {isRunning ? 'Training…' : trainMutation.isPending ? 'Starting…' : 'Fine-tune'}
                </Button>
              </div>
            </div>
          )}

          {/* Progress */}
          {btStatus && btStatus.state !== 'idle' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.textSecondary }}>
                  {btStatus.state === 'running'
                    ? `Epoch ${btStatus.epoch}/${btStatus.epochs} — loss ${btStatus.loss ?? '…'}`
                    : btStatus.state === 'done'
                      ? `Complete — ${btStatus.message}`
                      : `Error: ${btStatus.error}`}
                </span>
                <span style={{ fontSize: 11, color: C.textMuted }}>{btStatus.progress}%</span>
              </div>
              <ProgressBar pct={btStatus.progress} state={btStatus.state} />
              {btStatus.trained_at && (
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 6 }}>
                  Last trained: {btStatus.trained_at?.slice(0, 16).replace('T', ' ')}
                </div>
              )}
            </div>
          )}

          {trainMutation.isError && (
            <div style={{ marginTop: 10, fontSize: 11, color: C.red }}>{trainMutation.error?.message}</div>
          )}
        </CardBody>
      )}
    </Card>
  )
}

// ── LoRA adapter panel ────────────────────────────────────────

function ModelRow({ name, provider, task, loaded, description, details }) {
  return (
    <div style={{ display: 'flex', gap: 20, padding: '20px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{name}</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>{provider} · {task}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: loaded ? C.green : C.red, marginLeft: 'auto' }}>
            {loaded ? <CheckCircle size={10} /> : <XCircle size={10} />}
            {loaded ? 'loaded' : 'not loaded'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6 }}>{description}</div>
      </div>
      {details && (
        <div style={{ width: 180, flexShrink: 0, borderLeft: `1px solid ${C.border}`, paddingLeft: 20 }}>
          {Object.entries(details).map(([k, v]) => (
            <StatRow key={k} label={k} value={String(v)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ExpertRow({ type, status, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: accent, width: 90, textTransform: 'capitalize' }}>{type}</span>
      <span style={{ fontSize: 11, color: C.textMuted, flex: 1 }}>AdaLoRA · dynamic rank</span>
      {status?.path && <span className="truncate" style={{ fontSize: 10, color: C.textDim, maxWidth: 200 }}>{status.path}</span>}
      <Badge label={status?.exists ? 'trained' : 'untrained'} preset={status?.exists ? 'clean' : 'stable'} dot />
    </div>
  )
}

const EXPERT_ACCENTS = { noise: C.amber, accent: C.purple, pronunciation: C.red }
const LORA_ERROR_TYPES = ['all', 'noise', 'accent', 'pronunciation']

function LoRAPanel({ lora, experts, loraL, modelInfo, health, tts }) {
  const qc = useQueryClient()
  const [trainErrorType, setTrainErrorType] = useState('all')
  const [trainEpochs, setTrainEpochs]       = useState(3)
  const [trainError, setTrainError]         = useState(null)

  const { data: training } = useQuery({
    queryKey:        ['training_status'],
    queryFn:         getTrainingStatus,
    refetchInterval: (d) => d?.state === 'running' ? 3_000 : 30_000,
  })

  const trainMutation = useMutation({
    mutationFn: () => triggerTraining(trainErrorType === 'all' ? null : trainErrorType, trainEpochs),
    onSuccess:  () => { setTrainError(null); qc.invalidateQueries({ queryKey: ['training_status'] }) },
    onError:    (err) => setTrainError(err.message || 'Failed to start training'),
  })

  const isRunning  = training?.state === 'running'
  const expertList = experts ? Object.entries(experts) : [['noise', {}], ['accent', {}], ['pronunciation', {}]]
  const trained    = expertList.filter(([, s]) => s?.exists).length

  const asrBackend = modelInfo?.asr?.backend ?? 'whisper'
  const asrModel   = modelInfo?.asr?.model   ?? health?.asr ?? 'openai/whisper-small'
  const ttsModel   = modelInfo?.tts?.model   ?? tts?.model  ?? 'suno/bark'
  const asrShort   = asrBackend === 'whisper' ? 'Whisper' : 'Wav2Vec2'

  return (
    <>
      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderBottom: `1px solid ${C.border}`, paddingBottom: 28 }}>
        {[
          { label: 'ASR backend',  value: asrShort,       sub: asrModel.split('/').pop() },
          { label: 'TTS model',    value: 'Bark',         sub: ttsModel.split('/').pop() },
          { label: 'LoRA experts', value: `${trained}/3`, sub: 'AdaLoRA adaptive rank' },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '0 28px 0 0', borderRight: i < 2 ? `1px solid ${C.border}` : 'none', marginRight: i < 2 ? 28 : 0 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, lineHeight: 1.1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted, wordBreak: 'break-all' }}>{s.sub}</div>
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
          description={
            asrBackend === 'whisper'
              ? 'Encoder-decoder transformer trained on 680K hours of multilingual speech. Robust to noise and accents. Medical domain vocabulary injected via initial_prompt.'
              : 'Self-supervised CTC model. Per-frame confidence extraction and token-level uncertainty (Rumberg et al. 2023).'
          }
          details={{ Backend: asrBackend, Denoising: modelInfo?.asr?.denoising ? 'on' : 'off', Language: modelInfo?.asr?.language ?? 'en', SR: '16 kHz' }}
        />
        <ModelRow
          name={ttsModel}
          provider="Suno AI"
          task="TTS"
          loaded={tts?.available}
          description="GPT-style transformer for neural TTS. Synthesises target pronunciations for closed-loop remediation feedback."
          details={{ Output: '24 kHz WAV', Format: 'int16' }}
        />
      </div>

      {/* LoRA training */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
          <Label>Remedial LoRA fine-tuning</Label>
          {lora?.last_trained && (
            <span style={{ fontSize: 10, color: C.textMuted }}>last trained {lora.last_trained?.slice(0, 16)}</span>
          )}
        </div>

        <p style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
          Fine-tunes LoRA adapters on your collected remedial samples (the highest-error transcriptions).
          Uses AdaLoRA with 10% experience replay (Pekarek Rosin &amp; Wermter, ICANN 2023).
        </p>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Error type</div>
            <select
              value={trainErrorType}
              onChange={(e) => setTrainErrorType(e.target.value)}
              disabled={isRunning || trainMutation.isPending}
              style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textPrimary, fontSize: 11, padding: '6px 10px' }}
            >
              {LORA_ERROR_TYPES.map((t) => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Epochs</div>
            <input
              type="number" min={1} max={20} value={trainEpochs}
              onChange={(e) => setTrainEpochs(Math.max(1, Math.min(20, Number(e.target.value))))}
              disabled={isRunning || trainMutation.isPending}
              style={{ width: 64, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textPrimary, fontSize: 11, padding: '6px 10px', textAlign: 'center' }}
            />
          </div>

          <Button
            variant={isRunning ? 'secondary' : 'primary'}
            size="sm"
            icon={isRunning ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={12} />}
            onClick={() => trainMutation.mutate()}
            disabled={isRunning || trainMutation.isPending}
          >
            {isRunning ? 'Training…' : trainMutation.isPending ? 'Starting…' : 'Train'}
          </Button>
        </div>

        {training && training.state !== 'idle' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: C.textSecondary }}>
                {training.state === 'running' ? 'Training in progress…' : training.state === 'error' ? 'Training failed' : 'Training complete'}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>{training.progress}%</span>
            </div>
            <ProgressBar pct={training.progress} state={training.state} />
            {training.message && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 6 }}>{training.message}</div>}
          </div>
        )}
        {trainError && <div style={{ marginTop: 12, fontSize: 11, color: C.red }}>{trainError}</div>}
      </div>

      {/* LoRA experts */}
      <div>
        <Label>LoRA expert router</Label>
        {loraL ? <LoadingOverlay /> : expertList.map(([type, status]) => (
          <ExpertRow key={type} type={type} status={status} accent={EXPERT_ACCENTS[type] || C.blue} />
        ))}
        {lora?.training_logs?.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 11, color: C.textSecondary, lineHeight: 1.8 }}>
            {lora.training_logs.slice(-3).map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <span style={{ color: C.textDim }}>[{i + 1}]</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────

export default function ModelHub() {
  const { data: health }  = useQuery({ queryKey: ['health'],              queryFn: getHealth })
  const { data: tts }     = useQuery({ queryKey: ['tts_status'],          queryFn: getTtsStatus,         refetchInterval: 60_000 })
  const { data: lora, isLoading: loraL } = useQuery({ queryKey: ['lora_status'], queryFn: getLoraStatus, refetchInterval: 30_000 })
  const { data: experts } = useQuery({ queryKey: ['lora_experts_status'], queryFn: getLoraExpertsStatus, refetchInterval: 30_000 })
  const { data: dataset } = useQuery({ queryKey: ['dataset_stats'],       queryFn: getDatasetStats,      refetchInterval: 30_000 })
  const { data: modelInfo }= useQuery({ queryKey: ['model_info'],         queryFn: getModelInfo,         refetchInterval: 60_000 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1000 }}>

      {/* Step 1 — Download data */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: C.blueDim, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>Download training data</span>
        </div>
        <DatasetPanel />
      </div>

      {/* Step 2 — Base fine-tune */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.purple, background: C.purpleDim, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>Fine-tune on corpus</span>
        </div>
        <BaseTrainingPanel />
      </div>

      {/* Step 3 — LoRA adapters */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.greenDim, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>Remedial LoRA adapters</span>
        </div>
        <Card>
          <CardBody>
            <LoRAPanel lora={lora} experts={experts} loraL={loraL} modelInfo={modelInfo} health={health} tts={tts} />
          </CardBody>
        </Card>
      </div>

      {/* Dataset stats */}
      {dataset && (
        <Card>
          <CardHeader title="Dataset statistics" />
          <CardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 16 }}>
              {Object.entries(dataset).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
                <div key={k} style={{ borderTop: `2px solid ${C.border}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 5 }}>{k}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{String(v)}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
