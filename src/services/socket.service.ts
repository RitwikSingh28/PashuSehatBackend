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
    console.log('[Socket] Server initialized on port:', server.address()?.toString() ?? 'unknown');
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Initialize tracking for this socket
      console.log(`[Socket:${socket.id}] Initializing socket tracking`);
      this.socketToCattle.set(socket.id, new Set());

      // Handle subscribe request
      socket.on('subscribe-cattle', async (data: SubscribeData) => {
        try {
          const { cattleId, userId } = data;

          console.log(`[Socket:${socket.id}] Subscribe request - CattleID: ${cattleId}, UserID: ${userId}`);

          if (!cattleId || !userId) {
            console.error(`[Socket:${socket.id}] Missing cattleId or userId in subscribe request`);
            socket.emit('error', { message: 'Missing cattleId or userId' });
            return;
          }

          // Verify cattle belongs to user
          const cattle = await this.getCattleById(cattleId);
          console.log(`[Socket:${socket.id}] Cattle lookup result:`, cattle);

          if (!cattle || cattle.userId !== userId) {
            console.error(`[Socket:${socket.id}] Cattle not found or unauthorized - CattleID: ${cattleId}`);
            socket.emit('error', { message: 'Cattle not found or unauthorized' });
            return;
          }

          // Add to subscription maps
          if (!this.activeSubscriptions.has(cattleId)) {
            this.activeSubscriptions.set(cattleId, new Set());
          }
          const subscribers = this.activeSubscriptions.get(cattleId);
          const socketSubs = this.socketToCattle.get(socket.id);

          if (subscribers && socketSubs) {
            subscribers.add(socket.id);
            socketSubs.add(cattleId);

            console.log(`[Socket:${socket.id}] Successfully subscribed to cattle ${cattleId}. Total subscribers: ${subscribers.size}`);

            // Start polling if first subscriber
            if (subscribers.size === 1) {
              void this.startPollingData(cattleId);
            } else {
              console.log(`[Socket:${socket.id}] Additional subscriber - fetching current data`);
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
        console.log(`[Socket:${socket.id}] Unsubscribe request - CattleID: ${cattleId}`);
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
        id: string;
        cattleId: string;
        userId: string;
        tagId: string;
      }

      const result = await docClient.get({
        TableName: TABLES.CATTLE,
        Key: { cattleId }
      });

      console.log(`[DB] Cattle lookup result for ${cattleId}:`, result.Item);
    } catch (error) {
      console.error('Error getting cattle by ID:', error);
      return null;
    }
  }

  private async startPollingData(cattleId: string): Promise<void> {
    if (this.activePollers.has(cattleId)) {
      return; // Polling already active
    }

    console.log(`[Polling] Starting for cattle ${cattleId}`);

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
        console.error(`[Telemetry] Cattle ${cattleId} not found for telemetry fetch`);
        return;
      }

      const { tagId } = cattle;

      // Get latest telemetry data (last 10 records)
      const endTime = Date.now();
      console.log(`[Telemetry] Fetching data for tagId ${tagId} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
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

      console.log(`[Telemetry] Query result for ${tagId}:`, result.Items);

      // Send the latest data point if available
      if (result.Items && result.Items.length > 0) {
        const latestReading = result.Items[0] as TelemetryData;
        console.log(`[Telemetry] Latest reading for ${tagId}:`, latestReading);

        const subscribers = this.activeSubscriptions.get(cattleId);
        if (subscribers && subscribers.size > 0) {
          console.log(`Sending telemetry update to ${String(subscribers.size)} clients for cattle ${cattleId}`);

          // Send to all subscribers
          console.log(`[Telemetry] Broadcasting to ${subscribers.size} subscribers`);
          subscribers.forEach(socketId => {
            this.io.to(socketId).emit('telemetry-update', {
              ...latestReading // latestReading already contains cattleId
            });
          });
        }
      }
    } catch (error) {
      console.error(`[Telemetry] Error fetching data for ${cattleId}:`, error);
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

      console.log(`[Alerts] Query result for ${cattleId}:`, result.Items);

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
      console.error(`[Alerts] Error fetching alerts for ${cattleId}:`, error);
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

    console.log(`[Socket:${socketId}] Unsubscribed from cattle ${cattleId}`);
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
      console.log(`[Polling] Stopping for cattle ${cattleId}`);
      clearInterval(interval);
      this.activePollers.delete(cattleId);
    }
  }
}

export default new SocketService();
