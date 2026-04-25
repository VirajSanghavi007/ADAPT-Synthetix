const terminalOutput = document.getElementById('outputArea');
const terminalInput = document.getElementById('terminalInput');
const terminalBody = document.getElementById('terminal');
const terminalContainer = document.getElementById('terminalContainer');
const recordBtn = document.getElementById('recordBtn');
const statusDot = document.getElementById('statusDot');

let mediaRecorder;
let audioContext;
let chunkInterval;

// Global state for waveform.js
window.isRecording = false;
window.analyser = null;
window.dataArray = null;

// --- Simulated Terminal Logic ---
function print(text, color = null) {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    if (color) line.style.color = color;
    line.textContent = text;
    terminalOutput.appendChild(line);
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

async function handleCommand(rawCmd) {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    print(`> ${cmd}`);
    const [base, ...args] = cmd.split(' ');

    switch (base.toLowerCase()) {
        case 'echo':
            print(args.join(' '));
            break;
        case 'clear':
            terminalOutput.innerHTML = '';
            break;
        case 'synthesize':
            if (args.length === 0) {
                print(`Usage: synthesize [text]`);
            } else {
                synthesizeText(args.join(' '));
            }
            break;
        case 'history':
            try {
                const res = await fetch('/history');
                const history = await res.json();
                print(`--- RECENT TRANSCRIPTIONS ---`);
                history.forEach(row => {
                    print(`[${row.timestamp.split('T')[1].split('.')[0]}] ${row.transcription}`);
                });
            } catch (e) {
                print(`ERROR_FETCHING_HISTORY`, '#ff4500');
            }
            break;
        case 'help':
            print(`ADAPT-Synthetix Terminal v1.0`);
            print(`Available commands:`);
            print(`  echo [text]        — Print text to terminal`);
            print(`  synthesize [text]  — Generate speech using Bark-small`);
            print(`  history            — Show recent logs from SQLite`);
            print(`  remediation_status — Show remediation counters`);
            print(`  drift_report       — Show phoneme drift report`);
            print(`  noise_report       — Show aggregated noise profile report`);
            print(`  queue_status       — Show remediation priority queue`);
            print(`  dataset_stats      — Show dataset composition stats`);
            print(`  lora_status        — Show LoRA adapter status`);
            print(`  clear              — Clear terminal output`);
            print(`  status             — Show system status`);
            print(`  help               — Show this help message`);
            break;
        case 'status':
            try {
                const [healthRes, ttsRes] = await Promise.all([
                    fetch('/health'),
                    fetch('/tts_status')
                ]);
                const data = await healthRes.json();
                const ttsData = ttsRes.ok ? await ttsRes.json() : null;
                if (healthRes.ok) {
                    const sessionShort = ((data.session_id || '').toString()).slice(0, 8) || 'N/A';
                    print(`ASR Engine : wav2vec2-base-960h`);
                    print(`ASR Status : ONLINE`);
                    print(`TTS Engine : ${ttsData?.model || 'suno/bark-small'}`);
                    print(`TTS Status : ${ttsData?.available ? 'ONLINE' : 'OFFLINE'}`);
                    print(`DB Status  : ONLINE`);
                    print(`Session ID : ${sessionShort}`);
                } else {
                    throw new Error();
                }
            } catch (e) {
                print(`ERROR: Backend offline`, '#ff4500');
            }
            break;
        case 'remediation_status':
            try {
                const res = await fetch('/remediation_status');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch remediation status');
                print(`Total Transcriptions : ${data.total_transcriptions ?? 0}`);
                print(`Clean               : ${data.clean ?? 0}`);
                print(`Remediated          : ${data.remediated ?? 0}`);
                print(`Pending             : ${data.pending_remediation ?? 0}`);
                print(`Remediation Rate    : ${Number(data.remediation_rate ?? 0).toFixed(1)}%`);
            } catch (e) {
                print(`ERROR: Remediation status unavailable`, '#ff4500');
            }
            break;
        case 'drift_report':
            try {
                const res = await fetch('/drift_report');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch drift report');

                const degrading = Array.isArray(data.degrading)
                    ? data.degrading.map((d) => d.phoneme).filter(Boolean)
                    : [];
                const highRisk = Array.isArray(data.high_risk_phonemes) ? data.high_risk_phonemes : [];
                const retrainingNeeded = highRisk.length >= 3 ? 'YES' : 'NO';

                print(`Phonemes Tracked   : ${data.total_phonemes_tracked ?? 0}`);
                print(`Degrading          : ${degrading.length ? degrading.join(', ') : 'none'}`);
                print(`High Risk          : ${highRisk.length ? highRisk.join(', ') : 'none'}`);
                print(`Retraining Needed  : ${retrainingNeeded}`);
            } catch (e) {
                print(`ERROR: Drift report unavailable`, '#ff4500');
            }
            break;
        case 'noise_report':
            try {
                const res = await fetch('/noise_report');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch noise report');
                const breakdown = data.breakdown || {};
                print(`Noise Report`);
                print(`Total Analyzed     : ${data.total_analyzed ?? 0}`);
                print(`Most Common        : ${data.most_common ?? 'indoor'}`);
                print(`Clean              : ${breakdown.clean ?? 0}`);
                print(`Traffic            : ${breakdown.traffic ?? 0}`);
                print(`Crowd              : ${breakdown.crowd ?? 0}`);
                print(`Machinery          : ${breakdown.machinery ?? 0}`);
                print(`Indoor             : ${breakdown.indoor ?? 0}`);
            } catch (e) {
                print(`ERROR: Noise report unavailable`, '#ff4500');
            }
            break;
        case 'queue_status':
            try {
                const res = await fetch('/priority_queue');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch priority queue');

                const stats = data.stats || {};
                const queue = Array.isArray(data.queue) ? data.queue : [];
                const topItemRaw = queue.length > 0 ? String(queue[0].transcription || '') : 'none';
                const topItem = topItemRaw.length > 40 ? `${topItemRaw.slice(0, 40)}...` : topItemRaw;
                const avgPriority = Number(stats.avg_priority ?? 0).toFixed(2);

                print(`Remediation Queue`);
                print(`Pending      : ${stats.pending ?? 0}`);
                print(`Completed    : ${stats.completed ?? 0}`);
                print(`Avg Priority : ${avgPriority}`);
                print(`Top Item     : ${topItem}`);
            } catch (e) {
                print(`ERROR: Queue status unavailable`, '#ff4500');
            }
            break;
        case 'dataset_stats':
            try {
                const res = await fetch('/dataset_stats');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch dataset stats');
                const byCategory = data.by_category || {};
                const byNoiseType = data.by_noise_type || {};

                print(`Dataset Stats`);
                print(`Total Samples : ${data.total ?? 0}`);
                print(`Noisy         : ${byCategory.noisy ?? 0}`);
                print(`Accented      : ${byCategory.accented ?? 0}`);
                print(`Medical       : ${byCategory.medical ?? 0}`);
                print(`Clean         : ${byNoiseType.clean ?? 0}`);
            } catch (e) {
                print(`ERROR: Dataset stats unavailable`, '#ff4500');
            }
            break;
        case 'lora_status':
            try {
                const res = await fetch('/lora_status');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch LoRA status');

                print(`LoRA Adapter   : ${data.adapter_exists ? 'EXISTS' : 'NOT TRAINED'}`);
                print(`Last Trained   : ${data.last_trained || 'never'}`);
                const logCount = Array.isArray(data.training_logs) ? data.training_logs.length : 0;
                print(`Training Logs  : ${logCount} available`);
            } catch (e) {
                print(`ERROR: LoRA status unavailable`, '#ff4500');
            }
            break;
        default:
            print(`Command not found. Type 'help' for available commands.`, '#555');
    }
}

async function synthesizeText(text) {
    print(`Synthesizing... [${text}]`, '#555');
    try {
        const res = await fetch('/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok) {
            let errMsg = 'Unknown TTS error';
            if (contentType.includes('application/json')) {
                const errData = await res.json();
                errMsg = errData.error || errMsg;
            }
            print(`TTS_ERROR: ${errMsg}`, '#ff4500');
            return;
        }

        if (contentType.includes('audio')) {
            const audioBlob = await res.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onended = () => URL.revokeObjectURL(audioUrl);
            audio.play();
            print(`TTS_PLAYBACK: STARTED`, '#00e5ff');
        } else {
            const data = await res.json();
            if (data.audio_url) {
                const audio = new Audio(data.audio_url);
                audio.play();
                print(`TTS_PLAYBACK: STARTED`, '#00e5ff');
            } else {
                print(`TTS_ERROR: ${data.error || 'Invalid response'}`, '#ff4500');
            }
        }
    } catch (e) {
        print(`TTS_NETWORK_ERROR`, '#ff4500');
    }
}

// Keep terminal focused
terminalContainer.addEventListener('click', () => terminalInput.focus());
terminalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleCommand(terminalInput.value);
        terminalInput.value = '';
    }
});

// --- Audio Logic ---
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        window.analyser = audioContext.createAnalyser();
        window.analyser.fftSize = 256;
        window.dataArray = new Uint8Array(window.analyser.frequencyBinCount);
        source.connect(window.analyser);

        mediaRecorder = new MediaRecorder(stream);
        let chunks = [];

        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        mediaRecorder.onstop = () => {
            sendChunk(new Blob(chunks, { type: 'audio/webm' }));
            chunks = [];
        };

        window.isRecording = true;
        recordBtn.classList.add('recording');
        statusDot.style.background = '#ff4500';
        statusDot.style.boxShadow = '0 0 8px #ff4500';
        
        mediaRecorder.start();
        chunkInterval = setInterval(() => {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                mediaRecorder.start();
            }
        }, 5000);

    } catch (err) {
        print(`MIC_ERROR: ${err.message}`, '#ff4500');
    }
}

function stopRecording() {
    window.isRecording = false;
    recordBtn.classList.remove('recording');
    statusDot.style.background = '#00e5ff';
    statusDot.style.boxShadow = '0 0 8px #00e5ff';
    
    clearInterval(chunkInterval);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

async function sendChunk(blob) {
    if (blob.size < 500) return;
    const formData = new FormData();
    formData.append('audio', blob, 'chunk.webm');
    
    if (!window.sessionId) window.sessionId = crypto.randomUUID();
    formData.append('session_id', window.sessionId);

    try {
        const res = await fetch('/transcribe', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.transcription) {
            print(`[TRANSCRIPTION]: ${data.transcription}`);
            if (data.confidence !== undefined) {
                const confidencePercent = Number(data.confidence) * 100;
                if (Number.isFinite(confidencePercent)) {
                    print(`[CONFIDENCE]: ${confidencePercent.toFixed(1)}%`);
                }
            }
            if (data.noise_type !== undefined) {
                print(`[NOISE]: ${data.noise_type}`);
            }
            if (data.error_type !== undefined) {
                print(`[ERROR TYPE]: ${data.error_type}`);
            }
            synthesizeText(data.transcription);
        }
    } catch (e) {}
}

recordBtn.addEventListener('click', () => {
    if (!window.isRecording) startRecording(); else stopRecording();
});
