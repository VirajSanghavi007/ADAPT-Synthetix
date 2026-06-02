import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Cpu, Volume2, Zap, Database, CheckCircle, XCircle } from 'lucide-react'
import { getHealth, getTtsStatus, getLoraStatus, getLoraExpertsStatus, getDatasetStats } from '@/lib/api'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { LoadingOverlay } from '@/components/ui/Spinner'
import { C } from '@/lib/theme'

function ModelCard({ name, provider, task, description, loaded, details, icon, accent }) {
  const c = accent || C.cyan
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card glow={loaded ? c : C.border}>
        <CardBody>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 7, background: c + '16', border: `1px solid ${c}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c, flexShrink: 0 }}>
              {icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary, marginBottom: 1 }}>{name}</div>
              <div style={{ fontSize: 9, color: C.textMuted }}>{provider} · <span style={{ color: C.textSecondary }}>{task}</span></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: loaded ? C.green : C.red }}>
              {loaded ? <CheckCircle size={11} /> : <XCircle size={11} />}
              {loaded ? 'loaded' : 'not loaded'}
            </div>
          </div>
          <div style={{ fontSize: 10, color: C.textSecondary, lineHeight: 1.7, marginBottom: 10 }}>{description}</div>
          {details && (
            <div style={{ padding: '8px 10px', background: C.surfaceAlt, borderRadius: 5, border: `1px solid ${C.border}` }}>
              {Object.entries(details).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
                  <span style={{ color: C.textMuted }}>{k}</span>
                  <span style={{ color: C.textSecondary }}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  )
}

function ExpertCard({ type, status, i }) {
  const c = { noise: C.amber, accent: C.purple, pronunciation: C.red }[type] || C.cyan
  const exists = status?.exists
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
      <Card>
        <CardBody style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 5, background: c + '16', border: `1px solid ${c}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c, fontSize: 10, fontWeight: 700 }}>
            {type.slice(0,2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textPrimary, textTransform: 'capitalize', marginBottom: 2 }}>{type} Expert</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>AdaLoRA · wav2vec2-base-960h · dynamic rank</div>
            {status?.path && <div className="truncate" style={{ fontSize: 8, color: C.textDim, marginTop: 2, maxWidth: 200 }}>{status.path}</div>}
          </div>
          <Badge label={exists ? 'trained' : 'untrained'} preset={exists ? 'clean' : 'stable'} dot />
        </CardBody>
      </Card>
    </motion.div>
  )
}

export default function ModelHub() {
  const { data: health }    = useQuery({ queryKey: ['health'],           queryFn: getHealth })
  const { data: tts }       = useQuery({ queryKey: ['tts_status'],       queryFn: getTtsStatus,       refetchInterval: 60_000 })
  const { data: lora, isLoading: loraL } = useQuery({ queryKey: ['lora_status'],  queryFn: getLoraStatus,   refetchInterval: 30_000 })
  const { data: experts, isLoading: expL } = useQuery({ queryKey: ['lora_experts_status'], queryFn: getLoraExpertsStatus, refetchInterval: 30_000 })
  const { data: dataset }   = useQuery({ queryKey: ['dataset_stats'],    queryFn: getDatasetStats,    refetchInterval: 30_000 })

  const expertList     = experts ? Object.entries(experts) : [['noise',{}],['accent',{}],['pronunciation',{}]]
  const trainedExperts = expertList.filter(([, s]) => s?.exists).length

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard label="ASR Model"      value="Wav2Vec2"  sub={health?.asr || 'wav2vec2-base-960h'} accent={C.cyan}   icon={<Cpu size={14} />} />
        <StatCard label="TTS Model"      value="Bark"      sub={tts?.model || 'suno/bark-small'}      accent={C.purple} icon={<Volume2 size={14} />} />
        <StatCard label="LoRA Experts"   value={`${trainedExperts}/3`} sub="AdaLoRA adaptive rank"    accent={C.amber}  icon={<Zap size={14} />} />
        <StatCard label="Dataset Samples" value={dataset?.total ?? '—'} sub="fine-tuning corpus"      accent={C.green}  icon={<Database size={14} />} />
      </div>

      {/* Core models */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ModelCard
          name="facebook/wav2vec2-base-960h" provider="Meta AI" task="ASR"
          loaded={!!health?.asr} accent={C.cyan} icon={<Cpu size={16} />}
          description="Self-supervised contrastive pre-training on 960h LibriSpeech. CTC decoding. Per-frame confidence + token-level uncertainty via binary entropy (Rumberg et al. Interspeech 2023)."
          details={{ Architecture: 'Transformer 12-layer', Vocab: '32 chars (CTC)', SR: '16 kHz', PEFT: 'AdaLoRA adaptive rank' }}
        />
        <ModelCard
          name="suno/bark-small" provider="Suno AI" task="TTS"
          loaded={tts?.available} accent={C.purple} icon={<Volume2 size={16} />}
          description="GPT-style neural codec language model. Used for TTS-driven remediation: synthesises target pronunciation audio with phoneme-level control. Output stored for user feedback loop."
          details={{ Output: '24 kHz int16 WAV', Multilingual: 'yes', Remediation: 'phoneme-targeted' }}
        />
      </div>

      {/* LoRA Experts */}
      <Card>
        <CardHeader title="LoRA Expert Router" subtitle="HDMoLE-inspired MoE — AdaLoRA per acoustic failure domain (Mu et al. ICASSP 2025)"
          right={lora?.last_trained ? <span style={{ fontSize: 9, color: C.textMuted }}>{lora.last_trained?.slice(0, 16)}</span> : null}
        />
        <CardBody>
          {expL ? <LoadingOverlay /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {expertList.map(([type, status], i) => (
                <ExpertCard key={type} type={type} status={status} i={i} />
              ))}
            </div>
          )}
          {/* Training logs */}
          {lora?.training_logs?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 8, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Training Logs</div>
              <div style={{ maxHeight: 100, overflowY: 'auto', padding: '8px 10px', background: C.surfaceAlt, borderRadius: 5, border: `1px solid ${C.border}`, fontSize: 9, color: C.textSecondary, lineHeight: 1.8 }}>
                {lora.training_logs.map((log, i) => (
                  <div key={i} style={{ borderBottom: i < lora.training_logs.length - 1 ? `1px solid ${C.border}` : 'none', paddingBottom: 1 }}>
                    <span style={{ color: C.textMuted }}>[{i + 1}]</span> {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Dataset stats */}
      {dataset && (
        <Card>
          <CardHeader title="Dataset Statistics" subtitle="fine-tuning corpus" />
          <CardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
              {Object.entries(dataset).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
                <div key={k} style={{ padding: '9px 12px', background: C.surfaceAlt, borderRadius: 5, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 8, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{String(v)}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Research credits */}
      <Card>
        <CardHeader title="Research Basis" subtitle="papers implemented in this pipeline" />
        <CardBody>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['CTC Token Uncertainty', 'Rumberg et al., Interspeech 2023', C.cyan],
              ['Conformal Priority Queue', 'Ernez et al., PMLR 2023', C.purple],
              ['Phoneme Confusion Matrix', 'DyPCL / POWER — 30% threshold rule', C.green],
              ['CUSUM Drift Detection', 'arXiv:2407.05375, 2024', C.amber],
              ['AdaLoRA Adaptive Rank', 'Zhang et al., ICLR 2023', C.cyan],
              ['HDMoLE LoRA-MoE Routing', 'Mu et al., ICASSP 2025', C.red],
              ['Layer Freezing Strategy', 'Pekarek Rosin & Wermter, ICANN 2023', C.green],
              ['SVD Singular Value Tuning', 'Vander Eeckt et al., arXiv:2601.18266', C.purple],
            ].map(([title, ref, c]) => (
              <div key={title} style={{ display: 'flex', gap: 8, padding: '7px 10px', background: C.surfaceAlt, borderRadius: 5, border: `1px solid ${C.border}` }}>
                <div style={{ width: 3, borderRadius: 2, background: c, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary, marginBottom: 1 }}>{title}</div>
                  <div style={{ fontSize: 8, color: C.textMuted }}>{ref}</div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
