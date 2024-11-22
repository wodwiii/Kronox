export class AudioRecorder {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private isProcessing: boolean = false;
    private connection: any;
    private sampleRate: number = 44000;
    private bufferSize: number = 1024;

    constructor(connection: any) {
        this.connection = connection;
    }

    async initialize(stream: MediaStream): Promise<void> {
        try {
            this.mediaStream = stream;
            
            // Create AudioContext with the desired sample rate
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.audioContext = new AudioContextClass({
                sampleRate: this.sampleRate,
                latencyHint: 'interactive'
            });

            // Resume AudioContext if suspended (important for iOS)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Create and configure source
            this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Create ScriptProcessor (more widely supported than AudioWorklet)
            this.processor = this.audioContext.createScriptProcessor(
                this.bufferSize, 
                1, // mono input
                1  // mono output
            );

            // Set up audio processing
            this.processor.onaudioprocess = this.handleAudioProcess.bind(this);

            // Connect the nodes
            this.source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

            console.log('Audio recording system initialized');
        } catch (error) {
            console.error('Failed to initialize audio recording:', error);
            throw error;
        }
    }

    private handleAudioProcess(event: AudioProcessingEvent): void {
        if (!this.isProcessing || !this.connection) return;

        try {
            // Get the mono audio data
            const inputData = event.inputBuffer.getChannelData(0);
            
            // Convert to 16-bit PCM
            const outputData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                // Scale to 16-bit range and clamp
                const s = Math.max(-1, Math.min(1, inputData[i]));
                outputData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send to Deepgram if connection is open
            if (this.connection.isConnected && this.connection.isConnected()) {
                this.connection.send(outputData.buffer);
            }
        } catch (error) {
            console.error('Error processing audio:', error);
        }
    }

    start(): void {
        if (this.isProcessing) return;
        this.isProcessing = true;
        console.log('Started audio processing');
    }

    stop(): void {
        this.isProcessing = false;
        console.log('Stopped audio processing');
    }

    cleanup(): void {
        this.stop();
        
        if (this.processor && this.source) {
            this.processor.disconnect();
            this.source.disconnect();
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

        this.processor = null;
        this.source = null;
        this.audioContext = null;
        console.log('Audio recording system cleaned up');
    }
}