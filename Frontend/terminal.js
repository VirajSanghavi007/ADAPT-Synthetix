/**
 * frontend/terminal.js
 *
 * Polls GET /sessions every 5 seconds and renders the last 20 transcription
 * records into the #outputArea terminal div.
 *
 * Colour conventions (from style.css):
 *   clean       → var(--accent-idle)   [cyan  #00e5ff]
 *   all errors  → var(--accent-record) [red   #ff4500]
 */

const POLL_INTERVAL_MS = 5000;

/** Safely format a numeric value to N decimal places, or return a fallback. */
function fmt(value, decimals = 2, fallback = 'N/A') {
    const n = parseFloat(value);
    return isNaN(n) ? fallback : n.toFixed(decimals);
}

/** Format an ISO/SQLite timestamp to HH:MM:SS local time. */
function fmtTime(ts) {
    if (!ts) return '--:--:--';
    const d = new Date(ts.replace(' ', 'T'));  // SQLite uses space separator
    if (isNaN(d)) return ts;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function renderTerminal(sessions) {
    const outputArea = document.getElementById('outputArea');
    if (!outputArea) return;

    outputArea.innerHTML = '';

    if (!sessions || sessions.length === 0) {
        outputArea.innerHTML = '<div class="terminal-line" style="color:var(--text-dim)">No transcriptions yet.</div>';
        return;
    }

    sessions.forEach(s => {
        const isClean   = (s.error_type || 'clean').toLowerCase() === 'clean';
        const mainColor = isClean ? 'var(--accent-idle)' : 'var(--accent-record)';
        const label     = (s.error_type || 'clean').toUpperCase();
        const conf      = fmt((s.confidence_score || 0) * 100, 0) + '%';
        const cer       = fmt(s.cer_score, 2);
        const text      = s.transcript || '(empty)';
        const ts        = fmtTime(s.created_at);

        const entry = document.createElement('div');
        entry.className = 'terminal-line';
        entry.innerHTML = `
            <span style="color:var(--text-dim)">[${ts}]</span>&nbsp;<span style="color:${mainColor};font-weight:bold">${text}</span>
            <div style="
                font-size:0.70rem;
                color:#555;
                margin:2px 0 8px 12px;
                padding-left:10px;
                border-left:1px solid #1e1e1e;
                line-height:1.6;
            ">
                CER:&nbsp;<span style="color:${mainColor}">${cer}</span>
                &nbsp;|&nbsp;
                TYPE:&nbsp;<span style="color:${mainColor}">${label}</span>
                &nbsp;|&nbsp;
                CONF:&nbsp;<span style="color:${mainColor}">${conf}</span>
            </div>`;
        outputArea.appendChild(entry);
    });

    // Auto-scroll to the newest entry
    const body = document.getElementById('terminal');
    if (body) body.scrollTop = body.scrollHeight;
}

async function fetchSessions() {
    try {
        const res = await fetch('/sessions');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderTerminal(Array.isArray(data) ? data : []);
    } catch (err) {
        console.warn('[terminal.js] poll error:', err.message);
    }
}

// Kick-off
fetchSessions();
setInterval(fetchSessions, POLL_INTERVAL_MS);
