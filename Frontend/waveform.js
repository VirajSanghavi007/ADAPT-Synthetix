const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let analyser;
let dataArray;
let isRecording = false;

function initVisualizer() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    function renderFrame() {
        requestAnimationFrame(renderFrame);
        
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const barWidth = 3;
        const gap = 3;
        const totalBarWidth = barWidth + gap;
        const maxBars = Math.floor(width / totalBarWidth);
        const midX = width / 2;
        const midY = height / 2;
        
        if (window.isRecording && window.analyser) {
            window.analyser.getByteFrequencyData(window.dataArray);
        }

        for (let i = 0; i < maxBars / 2; i++) {
            let barHeight;
            if (window.isRecording && window.analyser) {
                const freqIdx = Math.floor((i / (maxBars / 2)) * (window.dataArray.length / 2));
                barHeight = (window.dataArray[freqIdx] / 255) * (height / 1.5) + 5;
            } else {
                barHeight = 4 + Math.sin(Date.now() * 0.005 + i * 0.3) * 6;
            }

            ctx.fillStyle = window.isRecording ? '#ff4500' : '#00363d';
            
            const xRight = midX + (i * totalBarWidth);
            ctx.fillRect(xRight, midY - barHeight/2, barWidth, barHeight);
            
            const xLeft = midX - (i * totalBarWidth) - barWidth;
            ctx.fillRect(xLeft, midY - barHeight/2, barWidth, barHeight);
        }
    }
    renderFrame();
}

window.initVisualizer = initVisualizer;
initVisualizer();
