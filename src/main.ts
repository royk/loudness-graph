import { AudioAnalyzer } from './AudioAnalyzer';
import { GraphRenderer } from './GraphRenderer';
import { UIManager } from './UIManager';

class LoudnessGraphApp {
    private audioAnalyzer: AudioAnalyzer;
    private graphRenderer: GraphRenderer;
    private uiManager: UIManager;

    constructor() {
        this.audioAnalyzer = new AudioAnalyzer();
        this.graphRenderer = new GraphRenderer();
        this.uiManager = new UIManager();
        
        this.initialize();
    }

    private initialize(): void {
        // Set up event listeners
        this.uiManager.onFileSelected((files: FileList) => {
            this.processFiles(files);
        });

        this.uiManager.onExport(() => {
            this.exportData();
        });

        this.uiManager.onReset(() => {
            this.reset();
        });

        console.log('Loudness Graph App initialized');
    }

    private async processFiles(files: FileList): Promise<void> {
        try {
            this.uiManager.showProgress();
            
            const results = await this.audioAnalyzer.analyzeFiles(files, (progress: number) => {
                this.uiManager.updateProgress(progress);
            });

            this.uiManager.hideProgress();
            this.uiManager.showGraph();
            
            this.graphRenderer.render(results);
            this.uiManager.updateStats(results);
            
        } catch (error) {
            console.error('Error processing files:', error);
            this.uiManager.showError(error instanceof Error ? error.message : 'Unknown error occurred');
            this.uiManager.hideProgress();
        }
    }

    private exportData(): void {
        const data = this.audioAnalyzer.getAnalysisData();
        if (data) {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'loudness-analysis.json';
            a.click();
            
            URL.revokeObjectURL(url);
        }
    }

    private reset(): void {
        this.audioAnalyzer.reset();
        this.graphRenderer.reset();
        this.uiManager.hideGraph();
        this.uiManager.clearError();
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LoudnessGraphApp();
}); 