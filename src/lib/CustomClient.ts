import type { RedisClientType } from "@redis/client";
import { Client, Events, type ClientOptions } from "discord.js";

export class CustomClient extends Client {
	constructor(options: ClientOptions & {database: RedisClientType<any, any, any>}) {
		super(options)
		this.once(Events.ClientReady, () => console.log(`Logged in as ${this.user!.tag}`));
		
	}
}