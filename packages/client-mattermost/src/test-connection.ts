import { MattermostService } from './services/mattermost.service';
import { config } from 'dotenv';

// Load environment variables
config();

async function test() {
    const service = new MattermostService();

    // Mock the minimum runtime interface
    const runtime = {
        getSetting: (key: string) => process.env[key],
    };

    try {
        await service.initialize(runtime as any);
        console.log('✅ Connected to Mattermost successfully');

        // Test sending a message (optional)
        // await service.sendMessage('your-channel-id', 'Test message from Eliza');

    } catch (error) {
        console.error('❌ Connection failed:', error);
    }
}

test();
