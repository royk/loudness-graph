export interface AudioAnalysisResult {
    fileName: string;
    duration: number;
    sampleRate: number;
    peakAmplitude: number;
    peakAmplitudeDb: number;
    lufs: number;
    rms: number;
    rmsDb: number;
    timeData: {
        time: number;
        peak: number;
        rms: number;
        lufs: number;
    }[];
}

export interface AnalysisData {
    results: AudioAnalysisResult[];
    summary: {
        totalDuration: number;
        averageLufs: number;
        averagePeakDb: number;
        maxPeakDb: number;
        minLufs: number;
        maxLufs: number;
        lufsRange: number;
    };
}

export class AudioAnalyzer {
    private analysisData: AnalysisData | null = null;
    private audioContext: AudioContext | null = null;

    constructor() {
        this.initializeAudioContext();
    }

    private initializeAudioContext(): void {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (error) {
            console.error('Failed to initialize AudioContext:', error);
        }
    }

    public async analyzeFiles(
        files: FileList, 
        progressCallback?: (progress: number) => void,
        lufsWindowSize: number = 3
    ): Promise<AnalysisData> {
        if (!this.audioContext) {
            throw new Error('AudioContext not available');
        }

        const results: AudioAnalysisResult[] = [];
        let totalProgress = 0;
        const progressPerFile = 100 / files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const result = await this.analyzeFile(file, lufsWindowSize);
                results.push(result);
                
                totalProgress += progressPerFile;
                progressCallback?.(Math.min(totalProgress, 100));
                
            } catch (error) {
                console.error(`Error analyzing file ${file.name}:`, error);
                throw new Error(`Failed to analyze ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        this.analysisData = {
            results,
            summary: this.calculateSummary(results)
        };

        return this.analysisData;
    }

    private async analyzeFile(file: File, lufsWindowSize: number = 3): Promise<AudioAnalysisResult> {
        if (!this.audioContext) {
            throw new Error('AudioContext not available');
        }

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0); // Use first channel for analysis
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        
        // Calculate peak amplitude
        const peakAmplitude = this.calculatePeakAmplitude(channelData);
        const peakAmplitudeDb = this.amplitudeToDb(peakAmplitude);
        
        // Calculate RMS
        const rms = this.calculateRMS(channelData);
        const rmsDb = this.amplitudeToDb(rms);
        
        // Calculate LUFS (simplified implementation)
        const lufs = this.calculateLUFS(channelData, sampleRate);
        
        // Generate time-based data
        const timeData = this.generateTimeData(channelData, sampleRate, duration, lufsWindowSize);
        
        return {
            fileName: file.name,
            duration,
            sampleRate,
            peakAmplitude,
            peakAmplitudeDb,
            lufs,
            rms,
            rmsDb,
            timeData
        };
    }

    private calculatePeakAmplitude(channelData: Float32Array): number {
        let peak = 0;
        for (let i = 0; i < channelData.length; i++) {
            const absValue = Math.abs(channelData[i]);
            if (absValue > peak) {
                peak = absValue;
            }
        }
        return peak;
    }

    private calculateRMS(channelData: Float32Array): number {
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
            sum += channelData[i] * channelData[i];
        }
        return Math.sqrt(sum / channelData.length);
    }

    private calculateLUFS(channelData: Float32Array, sampleRate: number): number {
        // Simplified LUFS calculation
        // In a real implementation, you would use proper EBU R128 filtering
        // This is a basic approximation using RMS with some frequency weighting
        
        const rms = this.calculateRMS(channelData);
        const rmsDb = this.amplitudeToDb(rms);
        
        // Apply basic frequency weighting (simplified)
        // LUFS is typically 10-15 dB lower than RMS
        const lufs = rmsDb - 12; // Simplified offset
        
        return lufs;
    }

    private calculateLUFSFromWindow(windowData: Float32Array): number {
        // Calculate LUFS for a specific window using 3-second sliding window approach
        // This is still an approximation but uses the proper window size
        
        if (windowData.length === 0) return -Infinity;
        
        const rms = this.calculateRMS(windowData);
        const rmsDb = this.amplitudeToDb(rms);
        
        // Apply simplified frequency weighting and gate threshold
        // For a 3-second window, we can be more selective about what constitutes "audio"
        const gateThreshold = -70; // dB threshold for silence
        
        if (rmsDb < gateThreshold) {
            return -Infinity; // Below gate threshold, consider as silence
        }
        
        // LUFS approximation: typically 10-15 dB lower than RMS
        // For 3-second windows, use a slightly different offset
        const lufs = rmsDb - 13; // Adjusted for 3-second window
        
        return lufs;
    }

    private generateTimeData(
        channelData: Float32Array, 
        sampleRate: number, 
        duration: number,
        lufsWindowSize: number = 3
    ): { time: number; peak: number; rms: number; lufs: number }[] {
        const timeData: { time: number; peak: number; rms: number; lufs: number }[] = [];
        
        // Use configurable sliding window for LUFS
        const lufsWindowSamples = Math.floor(sampleRate * lufsWindowSize);
        const stepSize = Math.floor(sampleRate * 0.1); // 100ms steps for smooth visualization
        
        // For peak and RMS, use smaller windows for more detail
        const peakWindowSize = Math.floor(sampleRate * 0.1); // 100ms windows
        
        let currentTime = 0;
        let currentIndex = 0;
        
        while (currentIndex < channelData.length) {
            // Calculate peak amplitude for current window
            const peakEnd = Math.min(currentIndex + peakWindowSize, channelData.length);
            const peakWindow = channelData.slice(currentIndex, peakEnd);
            const peak = this.calculatePeakAmplitude(peakWindow);
            const peakDb = this.amplitudeToDb(peak);
            
            // Calculate RMS for current window
            const rms = this.calculateRMS(peakWindow);
            const rmsDb = this.amplitudeToDb(rms);
            
            // Calculate LUFS using configurable sliding window
            const lufsEnd = Math.min(currentIndex + lufsWindowSamples, channelData.length);
            const lufsWindow = channelData.slice(currentIndex, lufsEnd);
            const lufs = this.calculateLUFSFromWindow(lufsWindow);
            
            timeData.push({
                time: currentTime,
                peak: peakDb,
                rms: rmsDb,
                lufs
            });
            
            currentTime += stepSize / sampleRate;
            currentIndex += stepSize;
            
            // Stop if we've processed all data
            if (currentIndex >= channelData.length) break;
        }
        
        return timeData;
    }

    private amplitudeToDb(amplitude: number): number {
        if (amplitude <= 0) return -Infinity;
        return 20 * Math.log10(amplitude);
    }

    private calculateSummary(results: AudioAnalysisResult[]): AnalysisData['summary'] {
        if (results.length === 0) {
            return {
                totalDuration: 0,
                averageLufs: 0,
                averagePeakDb: 0,
                maxPeakDb: 0,
                minLufs: 0,
                maxLufs: 0,
                lufsRange: 0
            };
        }

        const totalDuration = results.reduce((sum, result) => sum + result.duration, 0);
        const averageLufs = results.reduce((sum, result) => sum + result.lufs, 0) / results.length;
        const averagePeakDb = results.reduce((sum, result) => sum + result.peakAmplitudeDb, 0) / results.length;
        const maxPeakDb = Math.max(...results.map(r => r.peakAmplitudeDb));
        const minLufs = Math.min(...results.map(r => r.lufs));
        const maxLufs = Math.max(...results.map(r => r.lufs));
        const lufsRange = maxLufs - minLufs;

        return {
            totalDuration,
            averageLufs,
            averagePeakDb,
            maxPeakDb,
            minLufs,
            maxLufs,
            lufsRange
        };
    }

    public getAnalysisData(): AnalysisData | null {
        return this.analysisData;
    }

    public reset(): void {
        this.analysisData = null;
    }
} 