import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as qrcode from 'qrcode-terminal';
import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  WAMessage,
  WAMessageKey,
  WAPresence,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import {
  IWhatsAppConnection,
  WhatsAppConnectionState,
  WhatsAppConnectionEvent,
  WhatsAppIncomingMessage,
  WhatsAppOutgoingMessage,
  WhatsAppSendResult,
} from './whatsapp-integration.types';

@Injectable()
export class BaileysConnectionService
  implements IWhatsAppConnection, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BaileysConnectionService.name);
  private sock: WASocket | null = null;
  private connectionState: WhatsAppConnectionState =
    WhatsAppConnectionState.DISCONNECTED;
  private messageHandlers: Array<
    (message: WhatsAppIncomingMessage) => Promise<void>
  > = [];
  private connectionStateHandlers: Array<
    (event: WhatsAppConnectionEvent) => void
  > = [];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly authDir = path.join(process.cwd(), '.whatsapp-auth');
  private isShuttingDown = false;
  private readonly messageCache = new Map<string, WAMessage>();

  constructor(private configService: ConfigService) {
    this.ensureAuthDirExists();
  }

  async onModuleInit() {
    try {
      this.logger.log('[WhatsApp] Inicializando integração Baileys...');
      await this.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[WhatsApp] Erro ao inicializar: ${message}`);
    }
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    await this.close();
  }

  private ensureAuthDirExists(): void {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
      this.logger.debug(
        `[WhatsApp] Diretório de autenticação criado: ${this.authDir}`,
      );
    }
  }

  async connect(): Promise<void> {
    if (this.sock) {
      this.logger.warn('[WhatsApp] Já conectado ou conectando...');
      return;
    }

    this.updateConnectionState(
      WhatsAppConnectionState.CONNECTING,
      'Conectando ao WhatsApp...',
    );

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: this.createBaileysLogger(),
        browser: ['Booking Hub', 'Chrome', '120.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
      });

      this.sock.ev.on('creds.update', saveCreds);
      this.sock.ev.on('connection.update', (update) =>
        this.handleConnectionUpdate(update),
      );
      this.sock.ev.on('messages.upsert', (event) =>
        this.handleMessagesUpsert(event),
      );
      this.sock.ev.on('messages.update', (updates) =>
        this.handleMessagesUpdate(updates),
      );
      this.sock.ev.on('message-receipt.update', (updates) =>
        this.handleMessageReceiptUpdate(updates),
      );

      await new Promise<void>((resolve) => {
        const checkConnection = () => {
          if (this.sock?.user) {
            resolve();
            return;
          }
          setTimeout(checkConnection, 100);
        };
        checkConnection();
      });

      this.logger.log(
        `[WhatsApp] Conectado como ${this.sock?.user?.name || this.sock?.user?.id || 'usuário'}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[WhatsApp] Erro na conexão: ${message}`);
      this.updateConnectionState(
        WhatsAppConnectionState.DISCONNECTED,
        `Erro: ${message}`,
      );
      throw error;
    }
  }

  private handleConnectionUpdate(update: Partial<ConnectionState>) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      this.logger.warn(
        '[WhatsApp] QR Code disponível - escaneie com o WhatsApp',
      );
      this.updateConnectionState(
        WhatsAppConnectionState.QR_REQUIRED,
        'Escaneie o QR Code com o WhatsApp',
      );
      this.displayQRCode(qr);
    }

    if (connection === 'connecting') {
      this.updateConnectionState(
        WhatsAppConnectionState.CONNECTING,
        'Conectando ao WhatsApp...',
      );
      return;
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const wasLoggedOut = statusCode === DisconnectReason.loggedOut;

      if (!wasLoggedOut && !this.isShuttingDown) {
        this.logger.warn('[WhatsApp] Conexão perdida, tentando reconectar...');
        this.updateConnectionState(
          WhatsAppConnectionState.RECONNECTING,
          'Reconectando...',
        );
        this.sock = null;

        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }

        this.reconnectTimeout = setTimeout(() => {
          this.connect().catch((err) => {
            const message =
              err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`[WhatsApp] Erro na reconexão: ${message}`);
          });
        }, 3000);
        return;
      }

      this.logger.log('[Baileys] Sessão encerrada');
      this.updateConnectionState(
        wasLoggedOut
          ? WhatsAppConnectionState.LOGGED_OUT
          : WhatsAppConnectionState.DISCONNECTED,
        wasLoggedOut ? 'Logout definitivo' : 'Desconectado',
      );
      this.sock = null;
      return;
    }

    if (connection === 'open') {
      this.logger.log('[WhatsApp] Conectado com sucesso');
      this.updateConnectionState(
        WhatsAppConnectionState.CONNECTED,
        'Conectado',
      );
    }
  }

  private async handleMessagesUpsert(event: {
    messages: WAMessage[];
    type: string;
  }) {
    if (event.type !== 'notify') {
      return;
    }

    for (const message of event.messages) {
      try {
        if (!message?.key) {
          continue;
        }

        if (message.key.fromMe) {
          continue;
        }

        const remoteJid = message.key.remoteJid;
        if (
          !remoteJid ||
          remoteJid.includes('@g.us') ||
          remoteJid === 'status@broadcast'
        ) {
          this.logger.debug(
            '[WhatsApp] Ignorando mensagem fora do escopo do MVP',
          );
          continue;
        }

        const text =
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text;
        if (!text) {
          this.logger.debug('[WhatsApp] Ignorando mensagem sem texto');
          continue;
        }

        const jid = remoteJid;
        const sender = this.toPhoneNumber(jid);

        const incomingMessage: WhatsAppIncomingMessage = {
          jid,
          sender,
          text,
          timestamp: Number(
            message.messageTimestamp || Math.floor(Date.now() / 1000),
          ),
          messageId: message.key.id || '',
          isFromBot: false,
          isGroupMessage: false,
        };

        this.messageCache.set(`${jid}:${incomingMessage.messageId}`, message);

        this.logger.log(
          `📥 WHATSAPP — MENSAGEM RECEBIDA\n` +
            `   De: ${sender}\n` +
            `   Tipo: text\n` +
            `   Message ID: ${incomingMessage.messageId || '(sem id)'}\n` +
            `   Mensagem: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`,
        );

        for (const handler of this.messageHandlers) {
          try {
            await handler(incomingMessage);
          } catch (error) {
            const errMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
              `[WhatsApp] Erro ao processar mensagem recebida: ${errMessage}`,
            );
          }
        }
      } catch (error) {
        const errMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`[WhatsApp] Erro ao extrair mensagem: ${errMessage}`);
      }
    }
  }

  private handleMessagesUpdate(
    updates: Array<{ key: WAMessageKey; update: Partial<WAMessage> }>,
  ) {
    for (const update of updates) {
      const { key, update: messageUpdate } = update;
      const status = messageUpdate.status;

      if (status == null) {
        continue;
      }

      const statusLabel = this.mapStatusToLabel(Number(status));
      if (!statusLabel) {
        continue;
      }

      this.logger.log(
        `📡 ACK\n` +
          `   Message ID: ${key.id || '(sem id)'}\n` +
          `   Status: ${statusLabel}`,
      );
    }
  }

  private handleMessageReceiptUpdate(
    updates: Array<{
      key: WAMessageKey;
      receipt: {
        readTimestamp?: number | null | unknown;
        receiptTimestamp?: number | null | unknown;
      };
    }>,
  ) {
    for (const update of updates) {
      const messageId = update.key.id || '(sem id)';
      const deliveryTimestamp = update.receipt?.receiptTimestamp;
      const readTimestamp = update.receipt?.readTimestamp;

      if (deliveryTimestamp != null && Number(deliveryTimestamp) > 0) {
        this.logger.log(`📬 ENTREGA\n   Message ID: ${messageId}`);
      }

      if (readTimestamp != null && Number(readTimestamp) > 0) {
        this.logger.log(`👁 LEITURA\n   Message ID: ${messageId}`);
      }
    }
  }

  onMessage(
    callback: (message: WhatsAppIncomingMessage) => Promise<void>,
  ): void {
    this.messageHandlers.push(callback);
  }

  onConnectionStateChange(
    callback: (event: WhatsAppConnectionEvent) => void,
  ): void {
    this.connectionStateHandlers.push(callback);
  }

  async sendMessage(
    message: WhatsAppOutgoingMessage,
  ): Promise<WhatsAppSendResult> {
    if (!this.sock || !this.isConnected()) {
      return {
        messageId: '',
        timestamp: new Date(),
        status: 'failed',
        error: 'WhatsApp não está conectado',
      };
    }

    try {
      const destinationJid = message.jid || this.normalizeJid(message.to);
      if (destinationJid.includes('@g.us')) {
        throw new Error('Grupos não são permitidos no envio');
      }

      const result = await this.sock.sendMessage(destinationJid, {
        text: message.text,
      });
      const messageId = result?.key?.id || '';

      this.logger.log(
        `📤 ENVIO SOLICITADO\n` +
          `   Para: ${destinationJid}\n` +
          `   Message ID: ${messageId || '(sem id recebido)'}`,
      );

      return {
        messageId,
        timestamp: new Date(),
        status: 'pending',
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ WHATSAPP — ERRO AO ENVIAR\n` +
          `   Para: ${message.to}\n` +
          `   Erro: ${errMessage}`,
      );
      return {
        messageId: '',
        timestamp: new Date(),
        status: 'failed',
        error: errMessage,
      };
    }
  }

  async sendReply(
    message: WhatsAppOutgoingMessage,
    quoted?: { jid?: string; messageId?: string },
  ): Promise<WhatsAppSendResult> {
    if (!quoted?.jid || !quoted?.messageId) {
      return this.sendMessage(message);
    }

    const quotedMessage = this.messageCache.get(
      `${this.normalizeJid(quoted.jid)}:${quoted.messageId}`,
    );
    const payload = {
      ...message,
      quoted: quotedMessage
        ? { jid: quoted.jid, messageId: quoted.messageId }
        : undefined,
    };

    return this.sendMessage(payload);
  }

  async markAsRead(jid: string, messageId: string): Promise<void> {
    if (!this.sock || !this.isConnected()) {
      return;
    }

    try {
      const targetJid = this.normalizeJid(jid);
      const key: WAMessageKey = {
        remoteJid: targetJid,
        id: messageId,
        fromMe: false,
      };

      await this.sock.readMessages([key]);
      this.logger.log(
        `👁 WHATSAPP — MARCADA COMO LIDA\n   Para: ${targetJid}\n   Message ID: ${messageId}`,
      );
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ WHATSAPP — ERRO AO MARCAR COMO LIDA\n` +
          `   Para: ${jid}\n` +
          `   Message ID: ${messageId}\n` +
          `   Erro: ${errMessage}`,
      );
    }
  }

  async sendPresence(
    type: 'composing' | 'paused' | 'available' | 'unavailable',
    jid?: string,
  ): Promise<void> {
    if (!this.sock || !this.isConnected()) {
      return;
    }

    try {
      const presenceType = type as WAPresence;
      const target = jid ? this.normalizeJid(jid) : undefined;
      await this.sock.sendPresenceUpdate(presenceType, target);
      this.logger.debug(
        `[WhatsApp] Presence enviada: ${type}${target ? ` para ${target}` : ''}`,
      );
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[WhatsApp] Erro ao enviar presença: ${errMessage}`);
    }
  }

  getConnectionState(): WhatsAppConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return (
      this.connectionState === WhatsAppConnectionState.CONNECTED &&
      !!this.sock?.user
    );
  }

  async disconnect(): Promise<void> {
    if (!this.sock) {
      return;
    }

    try {
      this.sock.end(new Error('Temporary disconnect'));
      this.sock = null;
      this.updateConnectionState(
        WhatsAppConnectionState.DISCONNECTED,
        'Desconectado temporariamente',
      );
      this.logger.log('[WhatsApp] Conexão temporária encerrada');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `[WhatsApp] Erro ao desconectar temporariamente: ${message}`,
      );
    }
  }

  async logout(): Promise<void> {
    if (!this.sock) {
      return;
    }

    try {
      await this.sock.logout();
      this.sock = null;
      this.updateConnectionState(
        WhatsAppConnectionState.LOGGED_OUT,
        'Logout definitivo',
      );
      this.logger.log('[WhatsApp] Logout efetuado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[WhatsApp] Erro ao realizar logout: ${message}`);
    }
  }

  async close(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.sock) {
      try {
        this.sock.end(new Error('Module destruction'));
      } catch {
        // noop
      }
    }

    this.sock = null;
    this.updateConnectionState(
      WhatsAppConnectionState.DISCONNECTED,
      'Encerrado',
    );
  }

  private updateConnectionState(
    state: WhatsAppConnectionState,
    message: string,
  ): void {
    this.connectionState = state;
    const event: WhatsAppConnectionEvent = {
      state,
      timestamp: new Date(),
      message,
    };

    for (const handler of this.connectionStateHandlers) {
      try {
        handler(event);
      } catch (error) {
        const errMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `[WhatsApp] Erro ao executar handler de conexão: ${errMessage}`,
        );
      }
    }
  }

  private normalizeJid(value: string): string {
    if (!value) {
      throw new Error('JID vazio');
    }

    if (value.includes('@')) {
      return value;
    }

    const digits = value.replace(/\D/g, '');
    if (!digits) {
      throw new Error('JID inválido');
    }

    const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
    return `${withCountry}@s.whatsapp.net`;
  }

  private toPhoneNumber(jid: string): string {
    if (!jid) {
      return '';
    }

    return jid.split('@')[0].replace(/\D/g, '');
  }

  private mapStatusToLabel(status: number): string | undefined {
    switch (status) {
      case 2:
        return 'SERVER_ACK';
      case 3:
        return 'DELIVERED';
      case 4:
        return 'READ';
      default:
        return undefined;
    }
  }

  private displayQRCode(qr: string): void {
    try {
      console.log('\n');
      console.log('╔════════════════════════════════════════╗');
      console.log('║   ESCANEIE COM O WHATSAPP             ║');
      console.log('║   QR Code válido por 30 segundos      ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('\n');
      qrcode.generate(qr, { small: true });
      console.log('\n');
    } catch {
      this.logger.warn('Erro ao exibir QR Code no terminal');
    }
  }

  private createBaileysLogger() {
    return {
      level: 'silent' as any,
      log: () => undefined,
      error: () => undefined,
      warn: () => undefined,
      info: () => undefined,
      debug: () => undefined,
      trace: () => undefined,
      child: () => this.createBaileysLogger(),
    };
  }
}
