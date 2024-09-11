import type { RedisClientType } from "@redis/client";
import { Client, Collection, EmbedBuilder, Events, TextChannel, type ClientOptions, type GuildTextBasedChannel } from "discord.js";
import type { Command } from "./Command";
import { Glob } from "bun";
import lang from "../lang";

export class CustomClient extends Client {
	commands: Collection<string, Command>;
	db: RedisClientType<any, any, any>;

	constructor(options: ClientOptions & {database: RedisClientType<any, any, any>}) {
		super(options)
		this.db = options.database
		this.commands = new Collection();
		this.reloadCommands();

		this.on(Events.InteractionCreate, async (interaction) => {
			if (interaction.isCommand()) {
				const command = this.commands.get(interaction.commandName);
				if (command) {
					try {
						await command.execute(interaction, this.db);
					} catch (err) {
						if (!interaction.replied) interaction.reply({embeds: [new EmbedBuilder().setDescription(lang.unexpected_error.replace('{1}', 'COMMAND_FAILED')).setColor("Red")]});
						console.warn(`Command \`${interaction.commandName}\` returned with an error`, err);
					}
				} else {
					interaction.reply({embeds: [new EmbedBuilder().setDescription(lang.command_does_not_exist).setColor("Red")]});
					console.warn(`Unable to find command: ${interaction.commandName}`);
				}
			} else if (interaction.isButton()) {
				if (interaction.customId.startsWith("sorsolas-register-")) {
					await this.db.sAdd(`sorsolasok:${interaction.guildId}:${interaction.customId.split("-")[2]}:participants`, interaction.user.id);
					await interaction.reply({embeds: [new EmbedBuilder().setColor("Blue").setDescription(lang.enter_sorsolas)], ephemeral: true});

				} else if (interaction.customId.startsWith("roleselect-")) {
					const split = interaction.customId.split("-")[1].split(":");
					const roles = await this.db.hGet(`roleselect:${interaction.guildId}:${split[0]}`, "roles")
					if (!roles || Object.keys(roles).includes(split[1])) return;
					try {
						await (await interaction.guild?.members.fetch(interaction.user.id))?.roles.add(split[1]);
						await interaction.reply({embeds: [new EmbedBuilder().setColor("Blue").setDescription(lang.roleselect_selected.replace("{1}", `<@&${split[1]}>`))], ephemeral: true});
					} catch (err:any) {
						await interaction.reply({embeds: [new EmbedBuilder().setColor("Red").setDescription(lang.unexpected_error.replace("{1}", err))], ephemeral: true});
					}

				} else if (interaction.customId.startsWith("ticket-close-")) {
					const ticket_id = interaction.customId.split("-")[2];
					const ticket = await this.db.hGetAll(`ticket:${interaction.guildId}:${ticket_id}`);
					if (!ticket || ticket.user !== interaction.user.id) {
						await interaction.reply({embeds: [new EmbedBuilder().setColor("Red").setDescription(lang.ticket_not_found)], ephemeral: true});
						return;
					}
					const channel = await this.channels.fetch(ticket.channel) as GuildTextBasedChannel;
					if (!channel) {
						await this.db.del(`ticket:${interaction.guildId}:${ticket_id}`);
						await interaction.reply({embeds: [new EmbedBuilder().setColor("Red").setDescription(lang.ticket_not_found)], ephemeral: true});
						return;
					}
					await this.db.hSet(`ticket:${interaction.guildId}:${ticket_id}`, "status", "ticket_status_closed");
					await channel.send({content: lang.ticket_status_changed.replace("{1}", lang.ticket_statuses.ticket_status_closed)});
					await interaction.reply({embeds: [new EmbedBuilder().setColor("Blue").setDescription(lang.ticket_closed)], ephemeral: true});
				}
			}
		});

		this.on(Events.MessageCreate, async (message) => {
			console.log("msg");
			if (message.author.bot) return;
			await this.db.hIncrBy(`xp:${message.guildId}`, message.author.id, 5);
		});
		
		this.once(Events.ClientReady, () => {
			setInterval(async () => {
				(async ()=> {
					for (const guild of this.guilds.cache.values()) {
						for (const voice of guild.voiceStates.cache.values()) {
							if (voice.channelId && voice.member) {
								await this.db.hIncrBy(`xp:${guild.id}`, voice.member.id, 1);
							}
						}
					}
				})()

				const sorsolasok = await this.db.sMembers("sorsolasok");
				for (const sorsolas of sorsolasok) {
					const ss = sorsolas.split(":");
					if (parseInt(ss[1]) + parseFloat(ss[2]) * 60000 <= Date.now() ) {
						const sorsolas_id = ss[1];
						const guildId = ss[0];

						const sorsolas = await this.db.hGetAll(`sorsolasok:${ss[0]}:${sorsolas_id}`);
						if (!sorsolas || !sorsolas.messageId) continue;
						
						const winner = await this.db.sRandMember(`sorsolasok:${guildId}:${sorsolas_id}:participants`);
						
						const smsg = await (await this.channels.fetch(sorsolas.channelId) as GuildTextBasedChannel)?.messages.fetch(sorsolas.messageId);
						smsg.edit({components: []});
						smsg.reply(lang.sorsolas_winner.replace("{1}", `<@${winner}>`));

						await this.db.sRem("sorsolasok", `${guildId}:${sorsolas_id}:${ss[2]}`);
						await this.db.del([`sorsolasok:${guildId}:${sorsolas_id}`, `sorsolasok:${guildId}:${sorsolas_id}:participants`]);
					}
				}
			}, 60000)

			console.log(`Logged in as ${this.user!.tag}`)
			if (process.env.REGISTER_COMMANDS_AT_STARTUP == "1") {
				this.registerCommands();
			}
		});

		this.on(Events.GuildMemberAdd, async (member) => {
			const welcomemsg = await this.db.get(`welcome-message:${member.guild.id}`);
			if (!member.user.bot && welcomemsg) {
				if (!member.dmChannel) await member.createDM();
				if (member.dmChannel) member.dmChannel.send(welcomemsg);
			}
		});
	}

	reloadCommands() {
		this.commands = new Collection();
		const commandsDir = __dirname.replace("lib", "") + "commands/";
		for (const filename of new Glob("*.ts").scanSync({ cwd: commandsDir, onlyFiles: true, followSymlinks: false })) {
			const command: Command = require(commandsDir + filename).default;
			if ('data' in command && 'execute' in command) {
				this.commands.set(command.data.name, command);
			} else {
				console.warn(`Failed to load command from ${filename}`);
			}
		}
		console.log("Loaded slash commands");
	}

	registerCommands() {
		if (process.env.GUILD_ID) {
			const guild = this.guilds.resolve(process.env.GUILD_ID)
			if (guild) {
				guild.commands.set([...this.commands.values()].map((command) => command.data))
					.catch((err)=>console.warn(`Failed to register slash commands`, err))
				console.log("Registering slash commands to guild");
				return;
			}
		} else if (this.application) {
			this.application.commands.set([...this.commands.values()].map((command) => command.data))
			console.log("Registering slash commands to application");
			return;
		}
		console.log("Unable to register slash commands");
	}
}