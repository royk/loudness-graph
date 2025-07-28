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
        spectralBalance: number; // -1 (bassy/red) to 1 (bright/blue)
    }[];
    // Add audio buffer for playback
    audioBuffer: AudioBuffer;
    originalFile: File;
    // Add frequency band data (calculated on-demand)
    frequencyBandData?: {
        time: number;
        lowBandRms: number;
        midBandRms: number;
        highBandRms: number;
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
        const lufs = this.calculateLUFS(channelData);
        
        // Generate time-based data
        const timeData = this.generateTimeData(channelData, sampleRate, lufsWindowSize);
        
        return {
            fileName: file.name,
            duration,
            sampleRate,
            peakAmplitude,
            peakAmplitudeDb,
            lufs,
            rms,
            rmsDb,
            timeData,
            audioBuffer,
            originalFile: file
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

    private calculateLUFS(channelData: Float32Array): number {
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

    private calculateSpectralBalance(windowData: Float32Array): number {
        if (windowData.length === 0) return 0;
        
        // Use a much simpler approach based on amplitude distribution
        // This should be more reliable for music analysis
        
        let lowFreqEnergy = 0;
        let midFreqEnergy = 0;
        let highFreqEnergy = 0;
        
        // Simple frequency analysis using amplitude patterns
        for (let i = 0; i < windowData.length; i++) {
            const sample = Math.abs(windowData[i]);
            
            // Low frequency: higher amplitude samples (bass, kick drums)
            if (sample > 0.05) {
                lowFreqEnergy += sample;
            }
            
            // Mid frequency: moderate amplitude (vocals, guitars)
            if (sample > 0.01 && sample <= 0.05) {
                midFreqEnergy += sample;
            }
            
            // High frequency: low amplitude (cymbals, hi-hats, noise)
            if (sample <= 0.01) {
                highFreqEnergy += sample;
            }
        }
        
        // Normalize by window length
        const totalSamples = windowData.length;
        lowFreqEnergy /= totalSamples;
        midFreqEnergy /= totalSamples;
        highFreqEnergy /= totalSamples;
        
        // Calculate total energy
        const totalEnergy = lowFreqEnergy + midFreqEnergy + highFreqEnergy;
        
        if (totalEnergy === 0) return 0;
        
        // Calculate spectral balance based on energy distribution
        // More low frequency = negative (bassy)
        // More high frequency = positive (bright)
        const lowRatio = lowFreqEnergy / totalEnergy;
        const highRatio = highFreqEnergy / totalEnergy;
        
        // Spectral balance: -1 (all low freq) to +1 (all high freq)
        const spectralBalance = highRatio - lowRatio;
        
        // Debug logging for first few windows
        // if (windowData.length > 0 && Math.random() < 0.1) { // Log ~10% of windows to avoid spam
        //     console.log(`Spectral Debug: Low=${lowRatio.toFixed(3)}, Mid=${(midFreqEnergy/totalEnergy).toFixed(3)}, High=${highRatio.toFixed(3)}, Balance=${spectralBalance.toFixed(3)}`);
        // }
        
        return Math.max(-1, Math.min(1, spectralBalance));
    }



    private calculateFrequencyBandsSimple(windowData: Float32Array): { low: number; mid: number; high: number } {
        if (windowData.length === 0) {
            return { low: 0.001, mid: 0.001, high: 0.001 };
        }

        // Use a simpler but more reliable approach
        // Create three different "filters" based on amplitude and rate of change
        
        let lowEnergy = 0;
        let midEnergy = 0;
        let highEnergy = 0;
        
        // Calculate rate of change and amplitude characteristics
        let totalEnergy = 0;
        let maxAmplitude = 0;
        let avgRateOfChange = 0;
        
        for (let i = 0; i < windowData.length; i++) {
            const sample = windowData[i];
            const absSample = Math.abs(sample);
            
            totalEnergy += sample * sample;
            maxAmplitude = Math.max(maxAmplitude, absSample);
            
            // Calculate rate of change
            if (i > 0) {
                avgRateOfChange += Math.abs(sample - windowData[i-1]);
            }
        }
        
        avgRateOfChange /= (windowData.length - 1);
        
        // Distribute energy based on signal characteristics
        if (maxAmplitude > 0.05) {
            // High amplitude - likely bass/kick content
            lowEnergy = totalEnergy * 0.7;
            midEnergy = totalEnergy * 0.2;
            highEnergy = totalEnergy * 0.1;
        } else if (avgRateOfChange > 0.01) {
            // High rate of change - likely high frequency content
            lowEnergy = totalEnergy * 0.1;
            midEnergy = totalEnergy * 0.3;
            highEnergy = totalEnergy * 0.6;
        } else if (avgRateOfChange > 0.005) {
            // Moderate rate of change - likely mid frequency content
            lowEnergy = totalEnergy * 0.2;
            midEnergy = totalEnergy * 0.6;
            highEnergy = totalEnergy * 0.2;
        } else {
            // Low rate of change - likely low frequency content
            lowEnergy = totalEnergy * 0.6;
            midEnergy = totalEnergy * 0.3;
            highEnergy = totalEnergy * 0.1;
        }
        
        // Ensure we have some minimum energy distribution
        if (totalEnergy === 0) {
            lowEnergy = 0.001;
            midEnergy = 0.001;
            highEnergy = 0.001;
        }
        
        // Convert to RMS
        const lowRms = Math.sqrt(lowEnergy / windowData.length);
        const midRms = Math.sqrt(midEnergy / windowData.length);
        const highRms = Math.sqrt(highEnergy / windowData.length);
        
        // Ensure we have some minimum values to display
        const minRms = 0.0001; // Minimum RMS value to prevent -Infinity dB
        const finalLowRms = Math.max(lowRms, minRms);
        const finalMidRms = Math.max(midRms, minRms);
        const finalHighRms = Math.max(highRms, minRms);
        


        return { low: finalLowRms, mid: finalMidRms, high: finalHighRms };
    }


    private generateTimeData(
        channelData: Float32Array, 
        sampleRate: number, 
        lufsWindowSize: number = 3
    ): { time: number; peak: number; rms: number; lufs: number; spectralBalance: number }[] {
        const timeData: { time: number; peak: number; rms: number; lufs: number; spectralBalance: number }[] = [];
        
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
            
            // Calculate spectral balance for the same window
            const spectralBalance = this.calculateSpectralBalance(lufsWindow);
            
            // Debug logging - let's see what values we're getting
            // if (currentTime < 5) { // Only log first 5 seconds to avoid spam
            //     console.log(`Time: ${currentTime.toFixed(1)}s, Spectral Balance: ${spectralBalance.toFixed(3)}`);
            // }
            
            timeData.push({
                time: currentTime,
                peak: peakDb,
                rms: rmsDb,
                lufs,
                spectralBalance
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

    // Add method to get audio buffer for a specific file
    public getAudioBuffer(fileName: string): AudioBuffer | null {
        if (!this.analysisData) return null;
        
        const result = this.analysisData.results.find(r => r.fileName === fileName);
        return result ? result.audioBuffer : null;
    }

    // Add method to get all audio buffers
    public getAllAudioBuffers(): { fileName: string; audioBuffer: AudioBuffer }[] {
        if (!this.analysisData) return [];
        
        return this.analysisData.results.map(result => ({
            fileName: result.fileName,
            audioBuffer: result.audioBuffer
        }));
    }

    public reset(): void {
        this.analysisData = null;
    }

    public calculateFrequencyBandsForResult(result: AudioAnalysisResult): void {
        if (result.frequencyBandData) {
            return; // Already calculated
        }

        const frequencyBandData: { time: number; lowBandRms: number; midBandRms: number; highBandRms: number }[] = [];
        
        // Get the original audio data
        const channelData = result.audioBuffer.getChannelData(0);
        const sampleRate = result.audioBuffer.sampleRate;
        
        // Use the same window size as the original analysis
        const lufsWindowSize = 3; // Default, could be made configurable
        const lufsWindowSamples = Math.floor(sampleRate * lufsWindowSize);
        const stepSize = Math.floor(sampleRate * 0.1); // 100ms steps
        
        let currentTime = 0;
        let currentIndex = 0;
        
        while (currentIndex < channelData.length) {
            // Calculate LUFS using configurable sliding window
            const lufsEnd = Math.min(currentIndex + lufsWindowSamples, channelData.length);
            const lufsWindow = channelData.slice(currentIndex, lufsEnd);
            
            // Calculate frequency bands for the same window
            const frequencyBands = this.calculateFrequencyBandsSimple(lufsWindow);
            const lowBandRms = this.amplitudeToDb(frequencyBands.low);
            const midBandRms = this.amplitudeToDb(frequencyBands.mid);
            const highBandRms = this.amplitudeToDb(frequencyBands.high);
            
            frequencyBandData.push({
                time: currentTime,
                lowBandRms,
                midBandRms,
                highBandRms
            });
            
            currentTime += stepSize / sampleRate;
            currentIndex += stepSize;
            
            // Stop if we've processed all data
            if (currentIndex >= channelData.length) break;
        }
        
        result.frequencyBandData = frequencyBandData;
    }

    public calculateFrequencyBandsForAllResults(): void {
        if (!this.analysisData) return;
        
        this.analysisData.results.forEach(result => {
            this.calculateFrequencyBandsForResult(result);
        });
    }
} 