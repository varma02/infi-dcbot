import { GatewayIntentBits as Intent } from 'discord.js';
import { CustomClient } from './lib/CustomClient';
import { createClient } from 'redis';
import type { LanguagePack } from './lib/LanguagePack';

const db = createClient();
try {
	await db.connect();
	console.log("Redis is ready");
} catch {
	console.error("Unable to connect to redis database!");
	process.exit(1);
}

let lang: LanguagePack
try {
	const langfile = Bun.file(__dirname.replace("src", "") + "lang/" + (process.env.LANGUAGE ? process.env.LANGUAGE.trim() : "en") + ".json")
	lang = await langfile.json()
} catch (err) {
	console.error("Failed to load language pack", err);
	process.exit(1);
}

const client = new CustomClient({
	intents: [Intent.Guilds, Intent.GuildMembers],
	database: db,
	language: lang,
});

for (const event of ["SIGINT", "SIGTERM", "SIGKILL"]) {
	process.once(event, async () => {
		console.warn("\nLogging out");
		await db.quit();
		await client.destroy();
	});
}

client.login(process.env.DISCORD_TOKEN);