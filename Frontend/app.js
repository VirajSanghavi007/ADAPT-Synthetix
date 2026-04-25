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
                    print(`ASR Engine: ${data.asr}`);
                    print(`TTS Engine: ${ttsData?.model || data.tts || 'unknown'}`);
                    print(`TTS Status: ${ttsData?.available ? 'ONLINE' : 'OFFLINE'}`);
                    print(`Status: ONLINE`);
                } else {
                    throw new Error();
                }
            } catch (e) {
                print(`ERROR: Backend offline`, '#ff4500');
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
                print(`[CONFIDENCE]: ${Number(data.confidence).toFixed(4)}`);
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
