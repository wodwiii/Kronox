export class TranscriptProcessor {
    private lastProcessedEndTime: number = 0;
    private transcript: string = '';

    processTranscript(data: any): string {
        // Skip if not final
        if (!data.is_final) {
            return '';
        }

        const alternatives = data.channel.alternatives[0];
        const words = alternatives.words;

        // Only process if words array exists and is not empty
        if (words && words.length > 0) {
            // Get the last word's end time from the current chunk
            const currentEndTime = words[words.length - 1].end;

            // Only process if this is a new segment (based on end time)
            if (currentEndTime > this.lastProcessedEndTime) {
                // Update the transcript
                this.transcript = alternatives.transcript;
                this.lastProcessedEndTime = currentEndTime;
            }
        }

        return this.transcript;
    }

    reset() {
        this.lastProcessedEndTime = 0;
        this.transcript = '';
    }

    getCurrentTranscript(): string {
        return this.transcript;
    }
}