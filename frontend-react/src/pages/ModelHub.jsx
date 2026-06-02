import { useQuery } from '@tanstack/react-query'
import { CheckCircle, XCircle } from 'lucide-react'
import { getHealth, getTtsStatus, getLoraStatus, getLoraExpertsStatus, getDatasetStats } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { LoadingOverlay } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'

function Label({ children }) {
  return <div style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>{children}</div>
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
      <span style={{ fontSize: 10, color: C.textMuted, flex: 1 }}>AdaLoRA · wav2vec2-base-960h · dynamic rank</span>
      {status?.path && <span className="truncate" style={{ fontSize: 8, color: C.textDim, maxWidth: 200 }}>{status.path}</span>}
      <Badge label={exists ? 'trained' : 'untrained'} preset={exists ? 'clean' : 'stable'} dot />
    </div>
  )
}

const EXPERT_ACCENTS = { noise: C.amber, accent: C.lavender, pronunciation: C.clay }

export default function ModelHub() {
  const { data: health }    = useQuery({ queryKey: ['health'],               queryFn: getHealth })
  const { data: tts }       = useQuery({ queryKey: ['tts_status'],           queryFn: getTtsStatus,       refetchInterval: 60_000 })
  const { data: lora, isLoading: loraL } = useQuery({ queryKey: ['lora_status'],  queryFn: getLoraStatus, refetchInterval: 30_000 })
  const { data: experts }   = useQuery({ queryKey: ['lora_experts_status'],  queryFn: getLoraExpertsStatus, refetchInterval: 30_000 })
  const { data: dataset }   = useQuery({ queryKey: ['dataset_stats'],        queryFn: getDatasetStats,    refetchInterval: 30_000 })

  const expertList = experts ? Object.entries(experts) : [['noise',{}],['accent',{}],['pronunciation',{}]]
  const trained    = expertList.filter(([, s]) => s?.exists).length

  return (
    <div style={{ display: 'grid', gap: 40, maxWidth: 1000 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderBottom: `1px solid ${C.border}`, paddingBottom: 28 }}>
        {[
          { label: 'ASR model',     value: 'Wav2Vec2',     sub: health?.asr || 'wav2vec2-base-960h' },
          { label: 'TTS model',     value: 'Bark',         sub: 'suno/bark-small' },
          { label: 'LoRA experts',  value: `${trained}/3`, sub: 'AdaLoRA adaptive rank' },
        ].map((s, i) => (
          <div key={s.label} style={{ padding: '0 28px 0 0', borderRight: i < 2 ? `1px solid ${C.border}` : 'none', marginRight: i < 2 ? 28 : 0 }}>
            <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, lineHeight: 1.1, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Core models */}
      <div>
        <Label>Core models</Label>
        <ModelRow
          name="facebook/wav2vec2-base-960h" provider="Meta AI" task="ASR"
          loaded={!!health?.asr} accent={C.teal}
          description="Self-supervised contrastive pre-training on 960h LibriSpeech. CTC decoding with per-frame confidence extraction and token-level uncertainty (Rumberg et al. 2023)."
          details={{ Architecture: 'Transformer 12L', Vocab: '32 chars', SR: '16 kHz' }}
        />
        <ModelRow
          name="suno/bark-small" provider="Suno AI" task="TTS"
          loaded={tts?.available} accent={C.lavender}
          description="GPT-style transformer for neural TTS. Used for phoneme-targeted remediation audio — synthesising target pronunciations for closed-loop feedback."
          details={{ Output: '24 kHz WAV', Format: 'int16' }}
        />
      </div>

      {/* LoRA experts */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <Label>LoRA expert router</Label>
          {lora?.last_trained && <span style={{ fontSize: 9, color: C.textMuted }}>last trained {lora.last_trained?.slice(0, 16)}</span>}
        </div>
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
