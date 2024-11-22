import { json, type RequestHandler } from '@sveltejs/kit';
import { AzureChatOpenAI } from '@langchain/openai';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

// Initialize Azure Speech config
const speechConfig = sdk.SpeechConfig.fromSubscription(
    import.meta.env.VITE_AZURE_SPEECH_KEY, 
    'southeastasia'
);
speechConfig.speechSynthesisVoiceName = 'en-US-CoraMultilingualNeural';
speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz64KBitRateMonoMp3;

const model = new AzureChatOpenAI({
    temperature: 0.25,
    model: 'gpt-4o-mini',
    // apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    maxRetries: 2,
    azureOpenAIApiKey: import.meta.env.VITE_AZURE_OPENAI_API_KEY, // In Node.js defaults to process.env.AZURE_OPENAI_API_KEY
    azureOpenAIApiInstanceName: import.meta.env.VITE_AZURE_OPENAI_API_INSTANCE_NAME, // In Node.js defaults to process.env.AZURE_OPENAI_API_INSTANCE_NAME
    azureOpenAIApiDeploymentName: import.meta.env.VITE_AZURE_OPENAI_API_DEPLOYMENT_NAME, // In Node.js defaults to process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME
    azureOpenAIApiVersion: import.meta.env.VITE_AZURE_OPENAI_API_VERSION, 
});

const messageHistories: Record<string, InMemoryChatMessageHistory> = {};

const customerServicePrompt = ChatPromptTemplate.fromMessages([
    [
        'system',
        `You are Sarah, a friendly and professional customer service representative for {companyName}.
        CRITICAL INSTRUCTION: KEEP ALL RESPONSES EXTREMELY SHORT AND CONCISE. LIMIT EACH RESPONSE TO 1-2 SENTENCES MAXIMUM. 

        Key Information:
        - Business Hours: {customerServiceHours}
        - Available Products:
        {products}

        Guidelines:
        - Start by warmly introducing yourself and the company
        - Be helpful, patient, and empathetic in your responses
        - Provide accurate product information including prices, availability, and features
        - Keep responses concise but informative
        - Use a natural, conversational tone
        - If you don't know something, be honest about it
        - Handle customer concerns professionally
        - End conversations politely

        Remember to:
        - Make every response short and concise. Do not talk too much.
        - Listen carefully to customer queries
        - Provide relevant product recommendations when appropriate
        - Explain policies clearly
        - Thank customers for their patience and business
        - Be upfront about being an AI assistant`
    ],
    ['placeholder', '{chat_history}'],
    ['human', '{input}']
]);

const chain = customerServicePrompt.pipe(model);

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

type CustomerServiceRequest = {
    input: string;
    products: string[];
    sessionId: string;
    isStart: boolean;
    companyName: string;
    customerServiceHours: string;
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        let { input, products, sessionId, isStart, companyName, customerServiceHours } = 
            (await request.json()) as CustomerServiceRequest;
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
                companyName,
                customerServiceHours
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