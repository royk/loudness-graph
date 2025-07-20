import { AnalysisData } from './AudioAnalyzer';

export class GraphRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private data: AnalysisData | null = null;

    constructor() {
        this.canvas = document.getElementById('loudnessCanvas') as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        
        this.ctx = this.canvas.getContext('2d')!;
        if (!this.ctx) {
            throw new Error('Could not get canvas context');
        }

        this.setupCanvas();
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
        this.data.results.forEach((result, fileIndex) => {
            const color1 = `hsl(${240 + fileIndex * 30}, 70%, 60%)`; // Peak amplitude
            const color2 = `hsl(${280 + fileIndex * 30}, 70%, 60%)`; // LUFS

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
                color1,
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
                color2,
                2
            );

            currentTime += result.duration;
        });
    }

    private drawLine(
        timeData: { time: number; peak: number; rms: number; lufs: number }[],
        dataType: 'peak' | 'lufs',
        startTime: number,
        totalDuration: number,
        minAmplitude: number,
        maxAmplitude: number,
        padding: number,
        graphWidth: number,
        graphHeight: number,
        color: string,
        lineWidth: number
    ): void {
        if (timeData.length === 0) return;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();

        timeData.forEach((point, index) => {
            const x = padding + ((startTime + point.time) / totalDuration) * graphWidth;
            const value = dataType === 'peak' ? point.peak : point.lufs;
            
            // Skip -Infinity values (silence)
            if (!isFinite(value)) {
                return;
            }
            
            const y = padding + graphHeight - ((value - minAmplitude) / (maxAmplitude - minAmplitude)) * graphHeight;

            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });

        this.ctx.stroke();
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

    public reset(): void {
        this.data = null;
        this.clear();
    }
} 