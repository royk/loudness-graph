export class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private currentSource: AudioBufferSourceNode | null = null;
    private gainNode: GainNode | null = null;
    private isPlaying: boolean = false;
    private currentTime: number = 0;
    private audioBuffers: Map<string, AudioBuffer> = new Map();

    constructor() {
        this.initializeAudioContext();
    }

    private initializeAudioContext(): void {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
        } catch (error) {
            console.error('Failed to initialize AudioContext for playback:', error);
        }
    }

    public setAudioBuffers(buffers: { fileName: string; audioBuffer: AudioBuffer }[]): void {
        this.audioBuffers.clear();
        buffers.forEach(({ fileName, audioBuffer }) => {
            this.audioBuffers.set(fileName, audioBuffer);
        });
    }

    public playFromTime(fileName: string, startTime: number): void {
        if (!this.audioContext || !this.gainNode) {
            console.error('AudioContext not available for playback');
            return;
        }

        // Stop any currently playing audio
        this.stop();

        const audioBuffer = this.audioBuffers.get(fileName);
        if (!audioBuffer) {
            console.error(`Audio buffer not found for file: ${fileName}`);
            return;
        }

        // Ensure start time is within bounds
        const duration = audioBuffer.duration;
        if (startTime >= duration) {
            console.warn(`Start time ${startTime}s is beyond duration ${duration}s`);
            return;
        }

        try {
            // Create new audio source
            this.currentSource = this.audioContext.createBufferSource();
            this.currentSource.buffer = audioBuffer;
            this.currentSource.connect(this.gainNode);

            // Set the start time
            this.currentTime = startTime;
            
            // Start playback from the specified time
            this.currentSource.start(0, startTime);
            this.isPlaying = true;

            // Set up end event
            this.currentSource.onended = () => {
                this.isPlaying = false;
                this.currentSource = null;
            };

        } catch (error) {
            console.error('Error starting audio playback:', error);
        }
    }

    public stop(): void {
        if (this.currentSource && this.isPlaying) {
            try {
                this.currentSource.stop();
            } catch (error) {
                // Ignore errors when stopping already stopped source
            }
            this.currentSource = null;
            this.isPlaying = false;
        }
    }

    public isCurrentlyPlaying(): boolean {
        return this.isPlaying;
    }

    public getCurrentTime(): number {
        return this.currentTime;
    }

    public resumeAudioContext(): void {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    public dispose(): void {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
} 