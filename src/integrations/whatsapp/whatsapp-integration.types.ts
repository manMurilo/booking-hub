/**
 * Tipos para a integração de WhatsApp com Baileys
 * Esta camada abstrai os detalhes específicos do Baileys
 */

/**
 * Estados da conexão WhatsApp
 */
export enum WhatsAppConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  QR_REQUIRED = 'qr_required',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
}

/**
 * Evento de conexão do WhatsApp
 */
export interface WhatsAppConnectionEvent {
  state: WhatsAppConnectionState;
  timestamp: Date;
  message?: string;
  error?: Error;
}

/**
 * Mensagem normalizada recebida pelo WhatsApp
 * (abstraída de qualquer implementação específica)
 */
export interface WhatsAppIncomingMessage {
  jid: string; // WhatsApp JID (ID único da conversa)
  sender: string; // Número do remetente (ex: "5511987654321")
  text: string; // Conteúdo da mensagem
  timestamp: number; // Timestamp Unix em segundos
  messageId: string; // ID único da mensagem
  isFromBot?: boolean; // Se foi enviado pelo próprio bot
  isGroupMessage?: boolean; // Se é mensagem de grupo
}

/**
 * Mensagem a ser enviada pelo WhatsApp
 * (abstraída de qualquer implementação específica)
 */
export interface WhatsAppOutgoingMessage {
  to: string; // Número destino (ex: "5511987654321")
  text: string; // Conteúdo da mensagem
}

/**
 * Resultado do envio de mensagem
 */
export interface WhatsAppSendResult {
  messageId: string;
  timestamp: Date;
  status: 'sent' | 'failed' | 'pending';
  error?: string;
}

/**
 * Interface para o gerenciador de conexão WhatsApp
 * Define o contrato que qualquer integração (Baileys, Meta Cloud API, etc) deve implementar
 */
export interface IWhatsAppConnection {
  // Estados
  getConnectionState(): WhatsAppConnectionState;
  isConnected(): boolean;

  // Conexão
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Mensagens
  onMessage(callback: (message: WhatsAppIncomingMessage) => Promise<void>): void;
  sendMessage(message: WhatsAppOutgoingMessage): Promise<WhatsAppSendResult>;

  // Eventos
  onConnectionStateChange(callback: (event: WhatsAppConnectionEvent) => void): void;

  // Limpeza
  close(): Promise<void>;
}
