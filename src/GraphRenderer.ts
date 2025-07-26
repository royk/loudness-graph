import { AnalysisData } from './AudioAnalyzer';
import { AudioPlayer } from './AudioPlayer';

export class GraphRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private data: AnalysisData | null = null;
    private tooltip!: HTMLDivElement;
    private isMouseOver: boolean = false;
    private mouseX: number = 0;
    private mouseY: number = 0;
    private audioPlayer: AudioPlayer;
    private isMouseDown: boolean = false;

    constructor() {
        this.canvas = document.getElementById('loudnessCanvas') as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        
        this.ctx = this.canvas.getContext('2d')!;
        if (!this.ctx) {
            throw new Error('Could not get canvas context');
        }

        this.audioPlayer = new AudioPlayer();
        this.createTooltip();
        this.setupCanvas();
        this.setupMouseEvents();
    }

    private createTooltip(): void {
        this.tooltip = document.createElement('div');
        this.tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            pointer-events: none;
            z-index: 1000;
            display: none;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        document.body.appendChild(this.tooltip);
    }

    private setupMouseEvents(): void {
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        this.canvas.addEventListener('mouseenter', () => {
            this.isMouseOver = true;
            this.tooltip.style.display = 'block';
            this.updateCursor();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isMouseOver = false;
            this.tooltip.style.display = 'none';
            this.handleMouseUp();
            this.updateCursor();
        });

        // Add click and hold functionality
        this.canvas.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });

        this.canvas.addEventListener('mouseup', () => {
            this.handleMouseUp();
        });

        // Handle mouse up outside canvas
        document.addEventListener('mouseup', () => {
            this.handleMouseUp();
        });
    }

    private updateCursor(): void {
        if (this.isMouseOver && this.data) {
            const padding = 60;
            const graphWidth = this.canvas.width - 2 * padding;
            const graphHeight = this.canvas.height - 2 * padding;

            // Check if mouse is within the graph area
            if (this.mouseX >= padding && this.mouseX <= padding + graphWidth &&
                this.mouseY >= padding && this.mouseY <= padding + graphHeight) {
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'default';
            }
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.data || !this.isMouseOver) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        this.updateCursor();

        const padding = 60;
        const graphWidth = this.canvas.width - 2 * padding;
        const graphHeight = this.canvas.height - 2 * padding;

        // Check if mouse is within the graph area
        if (this.mouseX < padding || this.mouseX > padding + graphWidth ||
            this.mouseY < padding || this.mouseY > padding + graphHeight) {
            this.tooltip.style.display = 'none';
            return;
        }

        // Calculate time and amplitude from mouse position
        const totalDuration = this.data.summary.totalDuration;
        const time = ((this.mouseX - padding) / graphWidth) * totalDuration;

        // Find the closest data point
        const closestPoint = this.findClosestDataPoint(time);
        if (closestPoint) {
            this.updateTooltip(closestPoint, e.pageX, e.pageY);
        }
    }

    private handleMouseDown(e: MouseEvent): void {
        if (!this.data || !this.isMouseOver) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        const padding = 60;
        const graphWidth = this.canvas.width - 2 * padding;
        const graphHeight = this.canvas.height - 2 * padding;

        // Check if mouse is within the graph area
        if (this.mouseX < padding || this.mouseX > padding + graphWidth ||
            this.mouseY < padding || this.mouseY > padding + graphHeight) {
            return;
        }

        // Calculate time from mouse position
        const totalDuration = this.data.summary.totalDuration;
        const time = ((this.mouseX - padding) / graphWidth) * totalDuration;

        // Find which file this time corresponds to
        const fileInfo = this.findFileAtTime(time);
        if (fileInfo) {
            this.isMouseDown = true;
            
            // Resume audio context if needed (required for user interaction)
            this.audioPlayer.resumeAudioContext();
            
            // Start playback from the calculated time
            this.audioPlayer.playFromTime(fileInfo.fileName, fileInfo.localTime);
            
            // Add visual feedback
            this.canvas.style.cursor = 'grabbing';
        }
    }

    private handleMouseUp(): void {
        if (this.isMouseDown) {
            this.isMouseDown = false;
            this.audioPlayer.stop();
            
            // Restore cursor
            this.updateCursor();
        }
    }

    private findFileAtTime(targetTime: number): { fileName: string; localTime: number } | null {
        if (!this.data) return null;

        let currentTime = 0;
        
        for (const result of this.data.results) {
            const fileEndTime = currentTime + result.duration;
            
            if (targetTime >= currentTime && targetTime <= fileEndTime) {
                const localTime = targetTime - currentTime;
                return {
                    fileName: result.fileName,
                    localTime: localTime
                };
            }
            
            currentTime = fileEndTime;
        }
        
        return null;
    }

    private findClosestDataPoint(targetTime: number): { time: number; peak: number; rms: number; lufs: number; spectralBalance: number; fileName: string } | null {
        if (!this.data) return null;

        let closestPoint: { time: number; peak: number; rms: number; lufs: number; spectralBalance: number; fileName: string } | null = null;
        let minDistance = Infinity;
        let currentTime = 0;

        this.data.results.forEach(result => {
            result.timeData.forEach(point => {
                const pointTime = currentTime + point.time;
                const distance = Math.abs(pointTime - targetTime);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = {
                        ...point,
                        fileName: result.fileName
                    };
                }
            });
            currentTime += result.duration;
        });

        return closestPoint;
    }

    private updateTooltip(point: { time: number; peak: number; rms: number; lufs: number; spectralBalance: number; fileName: string }, pageX: number, pageY: number): void {
        const timeStr = this.formatTime(point.time);
        const peakStr = isFinite(point.peak) ? `${point.peak.toFixed(1)} dB` : 'Silence';
        const lufsStr = isFinite(point.lufs) ? `${point.lufs.toFixed(1)} LUFS` : 'Silence';
        const spectralStr = this.getSpectralDescription(point.spectralBalance);

        this.tooltip.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">${point.fileName}</div>
            <div>Time: ${timeStr}</div>
            <div>Peak: ${peakStr}</div>
            <div>LUFS: ${lufsStr}</div>
            <div>Spectral: ${spectralStr}</div>
        `;

        // Position tooltip using page coordinates (relative to document)
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let x = pageX + 15;
        let y = pageY - tooltipRect.height - 10;

        // Adjust if tooltip would go off screen
        if (x + tooltipRect.width > window.innerWidth + window.pageXOffset) {
            x = pageX - tooltipRect.width - 15;
        }
        if (y < window.pageYOffset) {
            y = pageY + 15;
        }

        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
        this.tooltip.style.display = 'block';
    }

    private setupCanvas(): void {
        // Set canvas size to match container
        const container = this.canvas.parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        }

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            if (container) {
                const rect = container.getBoundingClientRect();
                this.canvas.width = rect.width;
                this.canvas.height = rect.height;
                if (this.data) {
                    this.render(this.data);
                }
            }
        });
        resizeObserver.observe(this.canvas);
    }

    public render(data: AnalysisData): void {
        this.data = data;
        this.clear();
        this.drawGrid();
        this.drawData();
        this.drawLabels();
    }

    private clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    private drawGrid(): void {
        const { width, height } = this.canvas;
        const padding = 60;
        const graphWidth = width - 2 * padding;
        const graphHeight = height - 2 * padding;

        // Draw background
        this.ctx.fillStyle = '#f8f9ff';
        this.ctx.fillRect(padding, padding, graphWidth, graphHeight);

        // Draw grid lines
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;

        // Vertical grid lines (time)
        const timeSteps = 10;
        for (let i = 0; i <= timeSteps; i++) {
            const x = padding + (i / timeSteps) * graphWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, padding);
            this.ctx.lineTo(x, padding + graphHeight);
            this.ctx.stroke();
        }

        // Horizontal grid lines (amplitude)
        const amplitudeSteps = 8;
        for (let i = 0; i <= amplitudeSteps; i++) {
            const y = padding + (i / amplitudeSteps) * graphHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(padding + graphWidth, y);
            this.ctx.stroke();
        }
    }

    private drawData(): void {
        if (!this.data || this.data.results.length === 0) return;

        const { width, height } = this.canvas;
        const padding = 60;
        const graphWidth = width - 2 * padding;
        const graphHeight = height - 2 * padding;

        // Calculate time range
        const totalDuration = this.data.summary.totalDuration;
        let currentTime = 0;

        // Find amplitude range (filter out -Infinity values)
        let minAmplitude = Infinity;
        let maxAmplitude = -Infinity;

        this.data.results.forEach(result => {
            result.timeData.forEach(point => {
                // Only include finite values in range calculation
                if (isFinite(point.peak)) {
                    minAmplitude = Math.min(minAmplitude, point.peak);
                    maxAmplitude = Math.max(maxAmplitude, point.peak);
                }
                if (isFinite(point.lufs)) {
                    minAmplitude = Math.min(minAmplitude, point.lufs);
                    maxAmplitude = Math.max(maxAmplitude, point.lufs);
                }
            });
        });

        // Add some padding to the range
        const range = maxAmplitude - minAmplitude;
        minAmplitude -= range * 0.1;
        maxAmplitude += range * 0.1;

        // Draw data for each file
        this.data.results.forEach((result) => {

            // Draw peak amplitude line
            this.drawLine(
                result.timeData,
                'peak',
                currentTime,
                totalDuration,
                minAmplitude,
                maxAmplitude,
                padding,
                graphWidth,
                graphHeight,
                2
            );

            // Draw LUFS line
            this.drawLine(
                result.timeData,
                'lufs',
                currentTime,
                totalDuration,
                minAmplitude,
                maxAmplitude,
                padding,
                graphWidth,
                graphHeight,
                2
            );

            currentTime += result.duration;
        });
    }

    private drawLine(
        timeData: { time: number; peak: number; rms: number; lufs: number; spectralBalance: number }[],
        dataType: 'peak' | 'lufs',
        startTime: number,
        totalDuration: number,
        minAmplitude: number,
        maxAmplitude: number,
        padding: number,
        graphWidth: number,
        graphHeight: number,
        lineWidth: number
    ): void {
        if (timeData.length === 0) return;

        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (dataType === 'peak') {
            // Draw peak line normally (single color)
            this.ctx.strokeStyle = '#667eea'; // Default peak color
            this.ctx.beginPath();
            
            timeData.forEach((point, index) => {
                const x = padding + ((startTime + point.time) / totalDuration) * graphWidth;
                const value = point.peak;
                
                if (!isFinite(value)) return;
                
                const y = padding + graphHeight - ((value - minAmplitude) / (maxAmplitude - minAmplitude)) * graphHeight;

                if (index === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            });
            
            this.ctx.stroke();
        } else {
            // Draw LUFS line with spectral balance colors (segment by segment)
            for (let i = 1; i < timeData.length; i++) {
                const prevPoint = timeData[i - 1];
                const currentPoint = timeData[i];
                
                const prevValue = prevPoint.lufs;
                const currentValue = currentPoint.lufs;
                
                if (!isFinite(prevValue) || !isFinite(currentValue)) continue;
                
                const prevX = padding + ((startTime + prevPoint.time) / totalDuration) * graphWidth;
                const currentX = padding + ((startTime + currentPoint.time) / totalDuration) * graphWidth;
                
                const prevY = padding + graphHeight - ((prevValue - minAmplitude) / (maxAmplitude - minAmplitude)) * graphHeight;
                const currentY = padding + graphHeight - ((currentValue - minAmplitude) / (maxAmplitude - minAmplitude)) * graphHeight;
                
                // Use spectral balance from the current point for this segment
                const spectralBalance = currentPoint.spectralBalance;
                const color = this.getSpectralColor(spectralBalance);
                this.ctx.strokeStyle = color;
                
                // Debug logging for first few segments
                // if (i < 10) {
                //     console.log(`Segment ${i}: Spectral=${spectralBalance.toFixed(3)}, Color=${color}`);
                // }
                
                // Draw this segment
                this.ctx.beginPath();
                this.ctx.moveTo(prevX, prevY);
                this.ctx.lineTo(currentX, currentY);
                this.ctx.stroke();
            }
        }
    }

    private getSpectralColor(spectralBalance: number): string {
        // spectralBalance ranges from -1 (bassy/red) to 1 (bright/blue)
        // Use distinct colors for each spectral balance category
        
        if (spectralBalance < -0.5) {
            // Very Bass-heavy: Red
            return 'hsl(0, 80%, 50%)';
        } else if (spectralBalance < -0.1) {
            // Bass-heavy: Orange
            return 'hsl(30, 80%, 50%)';
        } else if (spectralBalance < 0.1) {
            // Neutral: Yellow
            return 'hsl(60, 80%, 50%)';
        } else if (spectralBalance < 0.5) {
            // Bright: Cyan
            return 'hsl(180, 80%, 50%)';
        } else {
            // Very Bright: Blue
            return 'hsl(240, 80%, 50%)';
        }
    }

    private drawLabels(): void {
        const { width, height } = this.canvas;
        const padding = 60;
        const graphWidth = width - 2 * padding;
        const graphHeight = height - 2 * padding;

        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.textAlign = 'center';

        // Time labels (bottom)
        const timeSteps = 10;
        for (let i = 0; i <= timeSteps; i++) {
            const x = padding + (i / timeSteps) * graphWidth;
            const time = (i / timeSteps) * (this.data?.summary.totalDuration || 0);
            const label = this.formatTime(time);
            this.ctx.fillText(label, x, height - 20);
        }

        // Amplitude labels (left)
        this.ctx.textAlign = 'right';
        const amplitudeSteps = 8;
        for (let i = 0; i <= amplitudeSteps; i++) {
            const y = padding + (i / amplitudeSteps) * graphHeight;
            const amplitude = this.data ? 
                this.data.summary.maxPeakDb - (i / amplitudeSteps) * (this.data.summary.maxPeakDb - this.data.summary.minLufs) :
                0;
            const label = `${amplitude.toFixed(1)} dB`;
            this.ctx.fillText(label, padding - 10, y + 4);
        }

        // Axis labels
        this.ctx.textAlign = 'center';
        this.ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.fillText('Time', width / 2, height - 5);
        
        this.ctx.save();
        this.ctx.translate(20, height / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.fillText('Amplitude (dB)', 0, 0);
        this.ctx.restore();
    }

    private formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    public setAudioPlayer(audioPlayer: AudioPlayer): void {
        this.audioPlayer = audioPlayer;
    }

    public updateAudioBuffers(): void {
        if (this.data) {
            const buffers = this.data.results.map(result => ({
                fileName: result.fileName,
                audioBuffer: result.audioBuffer
            }));
            this.audioPlayer.setAudioBuffers(buffers);
        }
    }

    public reset(): void {
        this.data = null;
        this.clear();
        this.tooltip.style.display = 'none';
        this.handleMouseUp(); // Stop any playing audio
    }

    private getSpectralDescription(spectralBalance: number): string {
        if (spectralBalance < -0.5) {
            return 'Very Bass-heavy';
        } else if (spectralBalance < -0.1) {
            return 'Bass-heavy';
        } else if (spectralBalance < 0.1) {
            return 'Neutral';
        } else if (spectralBalance < 0.5) {
            return 'Bright';
        } else {
            return 'Very Bright';
        }
    }
} 