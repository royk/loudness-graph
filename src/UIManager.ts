import { AnalysisData } from './AudioAnalyzer';

export class UIManager {
    private dropZone: HTMLElement;
    private fileInput: HTMLInputElement;
    private progress: HTMLElement;
    private progressFill: HTMLElement;
    private progressText: HTMLElement;
    private graphContainer: HTMLElement;
    private statsContainer: HTMLElement;
    private exportBtn: HTMLButtonElement;
    private resetBtn: HTMLButtonElement;

    private onFileSelectedCallback?: (files: FileList) => void;
    private onExportCallback?: () => void;
    private onResetCallback?: () => void;


    constructor() {
        this.dropZone = document.getElementById('dropZone')!;
        this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
        this.progress = document.getElementById('progress')!;
        this.progressFill = document.getElementById('progressFill')!;
        this.progressText = document.getElementById('progressText')!;
        this.graphContainer = document.getElementById('graphContainer')!;
        this.statsContainer = document.getElementById('stats')!;
        this.exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
        this.resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;

        this.initializeEventListeners();
    }

    private initializeEventListeners(): void {
        // File input change
        this.fileInput.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                this.onFileSelectedCallback?.(target.files);
            }
        });

        // Drag and drop events
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                this.onFileSelectedCallback?.(files);
            }
        });

        // Click to browse
        this.dropZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Export button
        this.exportBtn.addEventListener('click', () => {
            this.onExportCallback?.();
        });

        // Reset button
        this.resetBtn.addEventListener('click', () => {
            this.onResetCallback?.();
        });


    }

    public onFileSelected(callback: (files: FileList) => void): void {
        this.onFileSelectedCallback = callback;
    }

    public onExport(callback: () => void): void {
        this.onExportCallback = callback;
    }

    public onReset(callback: () => void): void {
        this.onResetCallback = callback;
    }

    public getCurrentLufsWindowSize(): number {
        const lufsWindowSelect = document.getElementById('lufsWindowSelect') as HTMLSelectElement;
        return parseFloat(lufsWindowSelect.value);
    }

    public showProgress(): void {
        this.progress.style.display = 'block';
        this.updateProgress(0);
    }

    public hideProgress(): void {
        this.progress.style.display = 'none';
    }

    public updateProgress(percentage: number): void {
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `Processing... ${Math.round(percentage)}%`;
    }

    public showGraph(): void {
        this.graphContainer.style.display = 'block';
    }

    public hideGraph(): void {
        this.graphContainer.style.display = 'none';
    }

    public updateStats(data: AnalysisData): void {
        const { summary, results } = data;

        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${results.length}</div>
                <div class="stat-label">Files Analyzed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.formatDuration(summary.totalDuration)}</div>
                <div class="stat-label">Total Duration</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.averageLufs.toFixed(1)}</div>
                <div class="stat-label">Average LUFS</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.averagePeakDb.toFixed(1)}</div>
                <div class="stat-label">Average Peak (dB)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.maxPeakDb.toFixed(1)}</div>
                <div class="stat-label">Max Peak (dB)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.lufsRange.toFixed(1)}</div>
                <div class="stat-label">LUFS Range</div>
            </div>
        `;
    }

    public showError(message: string): void {
        // Remove existing error
        this.clearError();

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;

        const uploadSection = this.dropZone.parentElement;
        if (uploadSection) {
            uploadSection.appendChild(errorDiv);
        }
    }

    public clearError(): void {
        const existingError = document.querySelector('.error');
        if (existingError) {
            existingError.remove();
        }
    }

    private formatDuration(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
} 