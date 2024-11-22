import { json, type RequestHandler } from '@sveltejs/kit';
import { ChatOpenAI } from '@langchain/openai';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

// Initialize Azure Speech config
const speechConfig = sdk.SpeechConfig.fromSubscription(
    import.meta.env.VITE_AZURE_SPEECH_KEY, 
    'southeastasia'
);
speechConfig.speechSynthesisVoiceName = 'en-US-AvaMultilingualNeural';
speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz64KBitRateMonoMp3;

const model = new ChatOpenAI({
    temperature: 0.25,
    model: 'gpt-4o-mini',
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    maxRetries: 2,
    streaming: false,
});

const messageHistories: Record<string, InMemoryChatMessageHistory> = {};

const supplierPrompt = ChatPromptTemplate.fromMessages([
    [
        'system',
        `You are Karen, a procurement agent making an outbound call to a supplier about restocking products. Start by:

        - Introducing yourself professionally as a procurement agent
        - Stating your company name and purpose for calling

        During the call:
        - Explain which specific products you need to restock
        - Ask about current availability and lead times
        - Discuss pricing and minimum order quantities
        - Confirm delivery options and timeframes
        
        Remember to:
        - Make every response short and concise. Do not talk too much.
        - Speak naturally but professionally
        - Listen actively and acknowledge responses
        - Be upfront about being an AI agent
        - Document all key details discussed
        - Thank them for their time at the end

        Company Name: {companyName}

        List of Products to restock:
        {products}
        `
    ],
    ['placeholder', '{chat_history}'],
    ['human', '{input}']
]);

const chain = supplierPrompt.pipe(model);

const withMessageHistory = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: async (sessionId: string) => {
        if (messageHistories[sessionId] === undefined) {
            messageHistories[sessionId] = new InMemoryChatMessageHistory();
        }
        return messageHistories[sessionId];
    },
    inputMessagesKey: 'input',
    historyMessagesKey: 'chat_history'
});

// Helper function to synthesize speech
const synthesizeSpeech = async (text: string): Promise<Uint8Array> => {
    return new Promise((resolve, reject) => {
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
        synthesizer.speakTextAsync(
            text,
            (result) => {
                if (result) {
                    const audioData = result.audioData;
                    synthesizer.close();
                    if (audioData && audioData.byteLength > 0) {
                        resolve(new Uint8Array(audioData));
                    } else {
                        reject(new Error('No audio data received'));
                    }
                } else {
                    synthesizer.close();
                    reject(new Error('Speech synthesis failed'));
                }
            },
            (error) => {
                synthesizer.close();
                reject(error);
            }
        );
    });
};

type SupplierRequest = {
    input: string;
    products: string[];
    sessionId: string;
    isStart: boolean;   
    companyName: string;
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        let { input, products, sessionId, isStart, companyName } = (await request.json()) as SupplierRequest;
        console.log(input);
        const config = {
            configurable: {
                sessionId
            }
        };
        if(isStart) {
            input = "Call connected..."
        }
        console.time('invoke');
        const response = await withMessageHistory.invoke(
            {
                input,
                products,
                companyName
            },
            config
        );
        console.timeEnd('invoke');

        const responseText = response.content as string;

        console.time('audio');
        const audioData = await synthesizeSpeech(responseText);
        console.timeEnd('audio');

        return new Response(audioData, {
            headers: {
                'Content-Type': 'audio/wav',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        console.error('Detailed error:', error);
        return json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        );
    }
};