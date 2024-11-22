import { createClient } from "@deepgram/sdk";

export async function generateDeepgramKey() {
    const uid = "1234567890";
    const projectId = "d25e61fa-973b-420f-a766-c3e5bedf986c"
    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
    const deepgram = createClient(apiKey);

    try {
        const { result, error } = await deepgram.manage.createProjectKey(projectId, {
            time_to_live_in_seconds: 360,
            comment: `${uid}`,
            scopes: [
                "usage:write"
            ],
        });

        if (error) {
            console.error('Error creating Deepgram API key:', error);
            return {
                success: false,
                error: 'Failed to create Deepgram API key',
                statusCode: 500
            };
        }

        return {
            success: true,
            key: result.key,
            statusCode: 201
        };
    } catch (error) {
        console.error('Error generating Deepgram API key:', error);
        return {
            success: false,
            error: 'Failed to generate Deepgram API key',
            statusCode: 500
        };
    }
}