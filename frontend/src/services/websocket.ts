import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    
    this.socket = io(API_BASE_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        if (this.socket) {
          this.socket.connect();
        }
      }, this.reconnectInterval * this.reconnectAttempts);
    }
  }

  // Event listeners
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event: string, data?: any): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  // Specific event handlers
  onTransactionUpdate(callback: (data: any) => void): void {
    this.on('transaction_update', callback);
  }

  onBalanceUpdate(callback: (data: any) => void): void {
    this.on('balance_update', callback);
  }

  onCardTransaction(callback: (data: any) => void): void {
    this.on('card_transaction', callback);
  }

  onLoanUpdate(callback: (data: any) => void): void {
    this.on('loan_update', callback);
  }

  onInvestmentUpdate(callback: (data: any) => void): void {
    this.on('investment_update', callback);
  }

  onNotification(callback: (data: any) => void): void {
    this.on('notification', callback);
  }

  onSecurityAlert(callback: (data: any) => void): void {
    this.on('security_alert', callback);
  }

  onKYCUpdate(callback: (data: any) => void): void {
    this.on('kyc_update', callback);
  }

  onGovernanceUpdate(callback: (data: any) => void): void {
    this.on('governance_update', callback);
  }

  onEscrowUpdate(callback: (data: any) => void): void {
    this.on('escrow_update', callback);
  }

  onLetterOfCreditUpdate(callback: (data: any) => void): void {
    this.on('letter_of_credit_update', callback);
  }

  onTokenizationUpdate(callback: (data: any) => void): void {
    this.on('tokenization_update', callback);
  }

  // Join specific rooms
  joinRoom(room: string): void {
    this.emit('join_room', room);
  }

  leaveRoom(room: string): void {
    this.emit('leave_room', room);
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
