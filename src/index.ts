import { GatewayIntentBits as Intent } from 'discord.js';
import { CustomClient } from './lib/CustomClient';
import { createClient } from 'redis';

const db = createClient({
	url: process.env.REDIS_URL,
});
try {
	await db.connect();
	if (!db.isReady) throw new Error();
	console.log("Redis is ready");
} catch {
	console.error("Unable to connect to redis database!");
	process.exit(1);
}

const client = new CustomClient({
	intents: [Intent.Guilds, Intent.GuildMembers],
	database: db,
});

for (const event of ["SIGINT", "SIGTERM", "SIGKILL"]) {
	process.once(event, () => {
		console.warn("\nLogging out");
		client.destroy();
		db.quit();
	});
}

client.login(process.env.DISCORD_TOKEN);