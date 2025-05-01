# Cattle Health Monitoring System - Backend Development Knowledge Base

## System Overview

Backend system supporting IoT-based cattle health monitoring with real-time data processing, alerts, and user management.

## Core Components

### 1. Server Architecture

- Express.js with TypeScript
- WebSocket support for real-time updates
- Integration with AWS services
- MongoDB for application data
- Redis for caching and sessions

### 2. AWS Infrastructure

- IoT Core for device communication
- Kinesis for data streaming
- Lambda for real-time processing
- DynamoDB for time-series data
- SNS for notifications
- API Gateway integration

### 3. Database Schema

#### MongoDB Collections

1. **Users**

```typescript
interface User {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  role: "farmer" | "admin" | "vet";
  farmId: string;
  name: string;
  phone: string;
  createdAt: Date;
  lastLogin: Date;
}

Cattle;
interface Cattle {
  _id: ObjectId;
  farmId: string;
  tagNumber: string;
  deviceId?: string;
  breed: string;
  dateOfBirth: Date;
  gender: "male" | "female";
  status: "active" | "inactive";
  healthRecords: HealthRecord[];
  notes: Note[];
  createdAt: Date;
  updatedAt: Date;
}

Farms;
interface Farm {
  _id: ObjectId;
  name: string;
  location: {
    address: string;
    coordinates: [number, number];
  };
  ownerId: ObjectId;
  createdAt: Date;
}
```

### DynamoDB Tables

CattleTelemetryRecent

```ts
interface TelemetryRecord {
  cattleId: string; // Partition Key
  timestamp: number; // Sort Key
  temperature: number;
  motion: number;
  pulseRate: number;
  location: {
    lat: number;
    lng: number;
  };
  batteryLevel: number;
  ttl: number; // Auto-deletion after 24h
}
```

CattleAlerts

```ts
interface Alert {
  cattleId: string; // Partition Key
  timestamp: number; // Sort Key
  type: "health" | "device" | "location";
  severity: "low" | "medium" | "high";
  metric: string;
  value: number;
  threshold: number | [number, number];
  status: "new" | "acknowledged" | "resolved";
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}
```

## 4. API Endpoints

Authentication

```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/refresh-token
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

User Management

```
GET    /api/users/me
PUT    /api/users/me
GET    /api/users          [Admin]
POST   /api/users          [Admin]
PUT    /api/users/:id      [Admin]
DELETE /api/users/:id      [Admin]
```

Cattle Management

```
GET    /api/cattle
POST   /api/cattle
GET    /api/cattle/:id
PUT    /api/cattle/:id
DELETE /api/cattle/:id
POST   /api/cattle/:id/notes
GET    /api/cattle/:id/metrics
GET    /api/cattle/:id/alerts
```

Device Management

```
GET    /api/devices
POST   /api/devices/register
GET    /api/devices/:id
PUT    /api/devices/:id
DELETE /api/devices/:id
GET    /api/devices/:id/status
```

Alert Management

```
GET    /api/alerts
PUT    /api/alerts/:id/acknowledge
GET    /api/alerts/cattle/:cattleId
POST   /api/alerts/rules
```

## 5. Real-time Features

WebSocket Events

```ts
// Client -> Server
interface ClientEvents {
  "subscribe-cattle": (cattleId: string) => void;
  "unsubscribe-cattle": (cattleId: string) => void;
}

// Server -> Client
interface ServerEvents {
  "telemetry-update": (data: TelemetryData) => void;
  "alert-notification": (alert: Alert) => void;
}
```

6. Data Processing Rules
   Alert Thresholds

```ts
interface AlertRule {
  metric: "temperature" | "motion" | "pulseRate";
  condition: "gt" | "lt" | "between";
  threshold: number | [number, number];
  duration: number; // seconds
  severity: "low" | "medium" | "high";
}

const defaultRules: AlertRule[] = [
  {
    metric: "temperature",
    condition: "between",
    threshold: [38.0, 39.5],
    duration: 300,
    severity: "medium",
  },
  {
    metric: "pulseRate",
    condition: "between",
    threshold: [60, 120],
    duration: 300,
    severity: "high",
  },
];
```

## 7. Security Requirements

- Authentication
- JWT-based authentication
- Token refresh mechanism
- Password hashing using bcrypt
- Rate limiting for auth endpoints
- Authorization
- Role-based access control
- Resource-level permissions
- Farm-level data isolation
- Data Security
- HTTPS/WSS for all communications
- Data encryption at rest
- Input validation
- SQL injection prevention
- XSS protection

## 8. Performance Considerations

- Caching Strategy
- Redis for session data
- Redis for frequently accessed cattle data
- API response caching
- Database Optimization
- Proper indexing
- Pagination for list endpoints
- Aggregation pipeline optimization
- Real-time Processing
- Batch processing for telemetry data
- WebSocket connection management
- Memory usage optimization

## 9. Monitoring Requirements

- System Health
- API endpoint response times
- WebSocket connection count
- Database performance metrics
- Cache hit/miss rates
- Business Metrics
- Active devices count
- Alert frequency
- Data processing latency
- User engagement metrics

## 10. Development Guidelines

- Code Organization
- Follow repository pattern
- Service layer abstraction
- Dependency injection
- Error handling middleware
- Testing Requirements
- Unit tests for services
- Integration tests for APIs
- WebSocket testing
- Load testing
- Documentation
- API documentation (Swagger/OpenAPI)
- WebSocket event documentation
- Setup instructions
- Deployment guide

## 11. Deployment Considerations

- Environment Setup
- Development
- Staging
- Production
- Configuration Management
- Environment variables
- AWS credentials
- Database connections
- API keys
- CI/CD Pipeline
- Automated testing
- Code quality checks
- Deployment automation
- Version management

This knowledge base provides a comprehensive overview of the backend system requirements and implementation details
