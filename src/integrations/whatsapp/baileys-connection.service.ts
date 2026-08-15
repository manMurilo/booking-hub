import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as qrcode from 'qrcode-terminal';
import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
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

/**
 * BaileysConnectionService
 * Gerencia a conexão real com WhatsApp através do Baileys
 *
 * Esta camada é responsável por:
 * - Autenticação e persistência de sessão
 * - Envio e recebimento de mensagens
 * - Gerenciamento de estados de conexão
 * - Reconexão automática
 *
 * NÃO deve ser utilizada diretamente pela lógica de negócio.
 * Use o WhatsAppService para processar mensagens.
 */
@Injectable()
export class BaileysConnectionService implements IWhatsAppConnection, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BaileysConnectionService.name);
  private sock: WASocket | null = null;
  private connectionState: WhatsAppConnectionState = WhatsAppConnectionState.DISCONNECTED;
  private messageHandlers: Array<(message: WhatsAppIncomingMessage) => Promise<void>> = [];
  private connectionStateHandlers: Array<(event: WhatsAppConnectionEvent) => void> = [];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly authDir = path.join(process.cwd(), '.whatsapp-auth');
  private isShuttingDown = false;

  constructor(private configService: ConfigService) {
    this.ensureAuthDirExists();
  }

  /**
   * Inicializar conexão ao carregar o módulo
   */
  async onModuleInit() {
    try {
      this.logger.log('[WhatsApp] Inicializando integração Baileys...');
      await this.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[WhatsApp] Erro ao inicializar: ${message}`);
    }
  }

  /**
   * Desconectar ao destruir o módulo
   */
  async onModuleDestroy() {
    this.isShuttingDown = true;
    await this.close();
  }

  /**
   * Garante que o diretório de autenticação existe
   */
  private ensureAuthDirExists(): void {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
      this.logger.debug(`[WhatsApp] Diretório de autenticação criado: ${this.authDir}`);
    }
  }

  /**
   * Conectar ao WhatsApp
   */
  async connect(): Promise<void> {
    if (this.sock) {
      this.logger.warn('[WhatsApp] Já conectado ou conectando...');
      return;
    }

    this.updateConnectionState(WhatsAppConnectionState.CONNECTING, 'Conectando ao WhatsApp...');

    try {
      // Carregar estado de autenticação persistido
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      // Criar socket
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Vamos exibir QR manualmente
        logger: this.createBaileysLogger(),
        browser: ['Booking Hub', 'Chrome', '120.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
      });

      // Configurar handlers de autenticação
      this.sock.ev.on('creds.update', saveCreds);

      // Handler de mudança de conexão
      this.sock.ev.on('connection.update', (update) => {
        this.handleConnectionUpdate(update);
      });

      // Handler de mensagens
      this.sock.ev.on('messages.upsert', (m) => {
        this.handleMessagesUpsert(m);
      });

      // Aguardar autenticação
      await new Promise<void>((resolve) => {
        const checkConnection = () => {
          if (this.sock?.user) {
            resolve();
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });

      this.logger.log(`[WhatsApp] Conectado como ${this.sock.user?.name || this.sock.user?.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[WhatsApp] Erro na conexão: ${message}`);
      this.updateConnectionState(WhatsAppConnectionState.DISCONNECTED, `Erro: ${message}`);
      throw error;
    }
  }

  /**
   * Handler para mudanças de conexão
   */
  private handleConnectionUpdate(update: Partial<ConnectionState>) {
    const { connection, lastDisconnect, qr } = update;

    // Novo QR Code
    if (qr) {
      this.logger.warn('[WhatsApp] QR Code disponível - escaneie com o WhatsApp');
      this.updateConnectionState(WhatsAppConnectionState.QR_REQUIRED, 'Escaneie o QR Code com o WhatsApp');
      this.displayQRCode(qr);
    }

    // Mudança de conexão
    if (connection === 'close') {
      // Desconectado
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect && !this.isShuttingDown) {
        this.logger.warn('[WhatsApp] Conexão perdida, tentando reconectar...');
        this.updateConnectionState(WhatsAppConnectionState.RECONNECTING, 'Reconectando...');
        this.sock = null;

        // Reconectar com delay
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }
        this.reconnectTimeout = setTimeout(() => {
          this.connect().catch((err) => {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`[WhatsApp] Erro na reconexão: ${message}`);
          });
        }, 3000);
      } else {
        this.logger.log('[WhatsApp] Desconectado (logout ou encerramento)');
        this.updateConnectionState(WhatsAppConnectionState.DISCONNECTED, 'Desconectado');
        this.sock = null;
      }
    } else if (connection === 'open') {
      // Conectado
      this.logger.log('[WhatsApp] Conectado com sucesso');
      this.updateConnectionState(WhatsAppConnectionState.CONNECTED, 'Conectado');
    }
  }

  /**
   * Handler para mensagens recebidas
   */
  private async handleMessagesUpsert(m: {
    messages: any[];
    type: string;
  }) {
    if (m.type !== 'notify') {
      return;
    }

    for (const message of m.messages) {
      try {
        // Ignorar mensagens do próprio bot
        if (message.key.fromMe) {
          continue;
        }

        // Ignorar mensagens de grupo
        if (message.key.remoteJid?.includes('@g.us')) {
          this.logger.debug('[WhatsApp] Ignorando mensagem de grupo');
          continue;
        }

        // Ignorar mensagens sem conteúdo de texto
        if (!message.message?.conversation && !message.message?.extendedTextMessage?.text) {
          this.logger.debug('[WhatsApp] Ignorando mensagem sem texto');
          continue;
        }

        // Extrair texto
        const text =
          message.message?.conversation || message.message?.extendedTextMessage?.text;

        if (!text) {
          continue;
        }

        // Normalizar JID para número
        const jid = message.key.remoteJid;
        const sender = jid.split('@')[0];

        // Criar mensagem normalizada
        const incomingMessage: WhatsAppIncomingMessage = {
          jid,
          sender,
          text,
          timestamp: message.messageTimestamp || Math.floor(Date.now() / 1000),
          messageId: message.key.id,
          isFromBot: message.key.fromMe,
          isGroupMessage: jid.includes('@g.us'),
        };

        // Log estruturado de mensagem recebida
        this.logger.log(
          `📥 WHATSAPP — MENSAGEM RECEBIDA\n` +
          `   De: ${sender}\n` +
          `   Tipo: text\n` +
          `   Message ID: ${message.key.id}\n` +
          `   Mensagem: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"\n` +
          `   Horário: ${new Date(message.messageTimestamp * 1000).toISOString()}`,
        );

        // Chamar handlers registrados
        for (const handler of this.messageHandlers) {
          try {
            await handler(incomingMessage);
          } catch (error) {
            const errMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`[WhatsApp] Erro ao processar mensagem: ${errMessage}`);
          }
        }
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`[WhatsApp] Erro ao extrair mensagem: ${errMessage}`);
      }
    }
  }

  /**
   * Registrar handler para recebimento de mensagens
   */
  onMessage(callback: (message: WhatsAppIncomingMessage) => Promise<void>): void {
    this.messageHandlers.push(callback);
  }

  /**
   * Registrar handler para mudanças de conexão
   */
  onConnectionStateChange(callback: (event: WhatsAppConnectionEvent) => void): void {
    this.connectionStateHandlers.push(callback);
  }

  /**
   * Enviar mensagem
   */
  async sendMessage(message: WhatsAppOutgoingMessage): Promise<WhatsAppSendResult> {
    if (!this.sock || !this.isConnected()) {
      return {
        messageId: '',
        timestamp: new Date(),
        status: 'failed',
        error: 'WhatsApp não está conectado',
      };
    }

    try {
      const jid = `${message.to}@s.whatsapp.net`;
      
      this.logger.log(
        `📤 WHATSAPP — ENVIANDO MENSAGEM\n` +
        `   Para: ${jid}\n` +
        `   Mensagem: "${message.text.substring(0, 100)}${message.text.length > 100 ? '...' : ''}"`,
      );

      const result = await this.sock.sendMessage(jid, {
        text: message.text,
      });

      // Log do retorno do sendMessage
      const messageId = result?.key?.id || '';
      const status = result?.key ? 'queued' : 'unknown';
      
      this.logger.log(
        `📨 WHATSAPP — SEND RESULT\n` +
        `   Para: ${message.to}\n` +
        `   Message ID: ${messageId}\n` +
        `   Status: ${status}`,
      );

      return {
        messageId,
        timestamp: new Date(),
        status: 'sent',
      };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unknown error';
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

  /**
   * Obter estado de conexão
   */
  getConnectionState(): WhatsAppConnectionState {
    return this.connectionState;
  }

  /**
   * Verificar se está conectado
   */
  isConnected(): boolean {
    return this.connectionState === WhatsAppConnectionState.CONNECTED && !!this.sock?.user;
  }

  /**
   * Desconectar
   */
  async disconnect(): Promise<void> {
    if (!this.sock) {
      return;
    }

    try {
      await this.sock.logout();
      this.sock = null;
      this.updateConnectionState(WhatsAppConnectionState.DISCONNECTED, 'Desconectado manualmente');
      this.logger.log('[WhatsApp] Desconectado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[WhatsApp] Erro ao desconectar: ${message}`);
    }
  }

  /**
   * Fechar conexão (limpeza)
   */
  async close(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.sock) {
      try {
        this.sock.end(new Error('Module destruction'));
      } catch (error) {
        // Ignorar erros ao fechar
      }
    }

    this.sock = null;
    this.updateConnectionState(WhatsAppConnectionState.DISCONNECTED, 'Encerrado');
  }

  /**
   * Atualizar estado de conexão e notificar handlers
   */
  private updateConnectionState(state: WhatsAppConnectionState, message: string): void {
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
        const errMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`[WhatsApp] Erro ao executar handler de conexão: ${errMessage}`);
      }
    }
  }

  /**
   * Exibir QR Code no terminal
   */
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
    } catch (error) {
      this.logger.warn('Erro ao exibir QR Code no terminal');
    }
  }

  /**
   * Criar logger personalizado para Baileys
   * Silencia logs desnecessários e remove dados sensíveis
   */
  private createBaileysLogger() {
    return {
      level: 'silent' as any,
      log: () => {},
      error: () => {}, // Silenciar erros internos do Baileys (são redundantes)
      warn: () => {}, // Silenciar warnings do Baileys
      info: () => {}, // Silenciar info do Baileys
      debug: () => {}, // Silenciar debug do Baileys
      trace: () => {},
      child: () => this.createBaileysLogger(),
    };
  }
}
