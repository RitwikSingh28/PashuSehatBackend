import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { docClient, TABLES } from "#config/aws.js";

// Define types for our socket events
interface SubscribeData {
  cattleId: string;
  userId: string;
}

interface TelemetryData {
  tagId: string;
  cattleId: string;
  temperature: number;
  heartRate: number;
  activity: number;
  timestamp: number;
}

interface AlertData {
  alertId: string;
  cattleId: string;
  tagId: string;
  type: string;
  message: string;
  status: 'new' | 'acknowledged' | 'resolved';
  timestamp: number;
}

class SocketService {
  private io!: SocketIOServer;
  private activePollers = new Map<string, NodeJS.Timeout>();
  private activeSubscriptions = new Map<string, Set<string>>(); // cattleId -> Set of socketIds
  private socketToCattle = new Map<string, Set<string>>(); // socketId -> Set of cattleIds

  initialize(server: HttpServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*', // For development
        methods: ['GET', 'POST']
      }
    });

    this.setupSocketHandlers();
    console.log('Socket.IO server initialized');
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Initialize tracking for this socket
      this.socketToCattle.set(socket.id, new Set());

      // Handle subscribe request
      socket.on('subscribe-cattle', async (data: SubscribeData) => {
        try {
          const { cattleId, userId } = data;

          if (!cattleId || !userId) {
            socket.emit('error', { message: 'Missing cattleId or userId' });
            return;
          }

          // Verify cattle belongs to user
          const cattle = await this.getCattleById(cattleId);
          if (!cattle || cattle.userId !== userId) {
            socket.emit('error', { message: 'Cattle not found or unauthorized' });
            return;
          }

          console.log(`Socket ${socket.id} subscribing to cattle ${cattleId}`);

          // Add to subscription maps
          if (!this.activeSubscriptions.has(cattleId)) {
            this.activeSubscriptions.set(cattleId, new Set());
          }
          const subscribers = this.activeSubscriptions.get(cattleId);
          const socketSubs = this.socketToCattle.get(socket.id);

          if (subscribers && socketSubs) {
            subscribers.add(socket.id);
            socketSubs.add(cattleId);

            // Start polling if first subscriber
            if (subscribers.size === 1) {
              void this.startPollingData(cattleId);
            } else {
              // Send latest data right away if we have other subscribers
              void this.fetchAndSendTelemetryData(cattleId);
            }
          }
        } catch (error) {
          console.error('Error handling subscription:', error);
          socket.emit('error', { message: 'Failed to subscribe' });
        }
      });

      // Handle unsubscribe
      socket.on('unsubscribe-cattle', (cattleId: string) => {
        this.unsubscribeSocket(socket.id, cattleId);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleSocketDisconnect(socket.id);
      });
    });
  }

  private async getCattleById(cattleId: string) {
    try {
      interface CattleItem {
        cattleId: string;
        userId: string;
        tagId: string;
      }

      const result = await docClient.get({
        TableName: TABLES.CATTLE,
        Key: { cattleId }
      });

      return result.Item as CattleItem | undefined;
    } catch (error) {
      console.error('Error getting cattle by ID:', error);
      return null;
    }
  }

  private async startPollingData(cattleId: string): Promise<void> {
    if (this.activePollers.has(cattleId)) {
      return; // Polling already active
    }

    console.log(`Starting polling for cattle ${cattleId}`);

    // Fetch data immediately on subscription
    await this.fetchAndSendTelemetryData(cattleId);

    // Then set up interval polling (every 5 seconds)
    const interval = setInterval(() => {
      void this.fetchAndSendTelemetryData(cattleId);
      void this.fetchAndSendAlerts(cattleId);
    }, 5000);

    this.activePollers.set(cattleId, interval);
  }

  private async fetchAndSendTelemetryData(cattleId: string): Promise<void> {
    try {
      // First get the tag ID for this cattle
      const cattle = await this.getCattleById(cattleId);
      if (!cattle) {
        console.error(`Cattle ${cattleId} not found`);
        return;
      }

      const { tagId } = cattle;

      // Get latest telemetry data (last 10 records)
      const endTime = Date.now();
      const startTime = endTime - (10 * 60 * 1000); // Last 10 minutes

      const result = await docClient.query({
        TableName: TABLES.TELEMETRY,
        KeyConditionExpression: 'tagId = :tagId AND #ts BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#ts': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':tagId': tagId,
          ':start': startTime,
          ':end': endTime
        },
        ScanIndexForward: false, // descending (newest first)
        Limit: 10
      });

      // Send the latest data point if available
      if (result.Items && result.Items.length > 0) {
        const latestReading = result.Items[0] as TelemetryData;

        const subscribers = this.activeSubscriptions.get(cattleId);
        if (subscribers && subscribers.size > 0) {
          console.log(`Sending telemetry update to ${String(subscribers.size)} clients for cattle ${cattleId}`);

          // Send to all subscribers
          subscribers.forEach(socketId => {
            this.io.to(socketId).emit('telemetry-update', {
              ...latestReading // latestReading already contains cattleId
            });
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching telemetry data for ${cattleId}:`, error);
    }
  }

  private async fetchAndSendAlerts(cattleId: string): Promise<void> {
    try {
      // Get recent unacknowledged alerts
      const result = await docClient.query({
        TableName: TABLES.ALERTS,
        IndexName: 'CattleIdIndex',
        KeyConditionExpression: 'cattleId = :cattleId',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':cattleId': cattleId,
          ':status': 'new'
        },
        ScanIndexForward: false, // newest first
        Limit: 5
      });

      if (result.Items && result.Items.length > 0) {
        const subscribers = this.activeSubscriptions.get(cattleId);
        if (subscribers && subscribers.size > 0) {
          // Send each new alert
          result.Items.forEach(alert => {
            subscribers.forEach(socketId => {
              this.io.to(socketId).emit('alert-notification', alert as AlertData);
            });
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching alerts for ${cattleId}:`, error);
    }
  }

  private unsubscribeSocket(socketId: string, cattleId: string): void {
    // Remove from cattleId -> socketId mapping
    const subscribers = this.activeSubscriptions.get(cattleId);
    if (subscribers) {
      subscribers.delete(socketId);

      // If no more subscribers, stop polling
      if (subscribers.size === 0) {
        this.stopPollingData(cattleId);
        this.activeSubscriptions.delete(cattleId);
      }
    }

    // Remove from socketId -> cattleId mapping
    const subscribedCattle = this.socketToCattle.get(socketId);
    if (subscribedCattle) {
      subscribedCattle.delete(cattleId);
    }

    console.log(`Socket ${socketId} unsubscribed from cattle ${cattleId}`);
  }

  private handleSocketDisconnect(socketId: string): void {
    console.log(`Socket disconnected: ${socketId}`);

    // Get all cattle this socket was subscribed to
    const subscribedCattle = this.socketToCattle.get(socketId);
    if (subscribedCattle) {
      // Unsubscribe from each one
      [...subscribedCattle].forEach(cattleId => {
        this.unsubscribeSocket(socketId, cattleId);
      });
    }

    // Remove socket tracking
    this.socketToCattle.delete(socketId);
  }

  private stopPollingData(cattleId: string): void {
    const interval = this.activePollers.get(cattleId);
    if (interval) {
      console.log(`Stopping polling for cattle ${cattleId}`);
      clearInterval(interval);
      this.activePollers.delete(cattleId);
    }
  }
}

export default new SocketService();
