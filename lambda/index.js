const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { v4: uuidv4 } = require("uuid");

// Initialize clients
const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const sns = new SNSClient({});

// Environment variables
const TELEMETRY_TABLE = process.env.DYNAMODB_TELEMETRY_TABLE;
const CATTLE_TABLE = process.env.DYNAMODB_CATTLE_TABLE;
const TAGS_TABLE = process.env.DYNAMODB_TAGS_TABLE;
const ALERTS_TABLE = process.env.DYNAMODB_ALERTS_TABLE;
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE;

// Health thresholds
const THRESHOLDS = {
  temperature: { min: 38.0, max: 39.5 },
  pulseRate: { min: 60, max: 80 },
  motionData: { min: 0, max: 3 },
  batteryLevel: { min: 20 },
};

// In-memory cache for telemetry readings (we'll use for windowing)
// Note: This is fine for demo purposes, but for production you might want
// to use something like DynamoDB or Redis to persist this between invocations
const telemetryWindows = {};

// Window size (12 readings = 1 minute at 5-sec intervals)
const WINDOW_SIZE = 12;

// Define cooldown periods for each alert type (in milliseconds)
const COOLDOWN_PERIODS = {
  temperature: 15 * 60 * 1000, // 15 minutes
  pulseRate: 15 * 60 * 1000, // 15 minutes
  motion: 10 * 60 * 1000, // 10 minutes
  battery: 60 * 60 * 1000, // 60 minutes
};

/**
 * Main handler for the Lambda function
 */
exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Extract data
    const { tagId, temperature, pulseRate, motionData, batteryLevel, timestamp = Date.now() } = event;

    if (!tagId) {
      console.error("Missing tagId in the event payload");
      return { statusCode: 400, body: "Missing tagId" };
    }

    // Add telemetry to DynamoDB with TTL
    await storeTelemetryReading({
      tagId,
      timestamp,
      temperature,
      pulseRate,
      motionData,
      batteryLevel,
      ttl: Math.floor(timestamp / 1000) + 86400, // 24 hour TTL
    });

    // Update tag last seen and battery info
    await updateTagStatus(tagId, timestamp, batteryLevel);

    // Add to telemetry window for this tag
    updateTelemetryWindow(tagId, {
      temperature,
      pulseRate,
      motionData,
      batteryLevel,
      timestamp,
    });

    // Process data for alerts if we have enough data
    if (telemetryWindows[tagId] && telemetryWindows[tagId].length >= WINDOW_SIZE) {
      await processWindowedData(tagId);
    }

    return { statusCode: 200, body: "Processed successfully" };
  } catch (error) {
    console.error("Error processing telemetry:", error);
    return { statusCode: 500, body: `Error: ${error.message}` };
  }
};

/**
 * Store telemetry reading in DynamoDB
 */
async function storeTelemetryReading(reading) {
  await ddb.send(
    new PutCommand({
      TableName: TELEMETRY_TABLE,
      Item: reading,
    }),
  );

  console.log(`Stored telemetry reading for tag ${reading.tagId}`);
}

/**
 * Update tag's last seen timestamp and battery level
 */
async function updateTagStatus(tagId, timestamp, batteryLevel) {
  try {
    const updateParams = {
      TableName: TAGS_TABLE,
      Key: { tagId },
      UpdateExpression: "SET lastSeen = :lastSeen",
      ExpressionAttributeValues: {
        ":lastSeen": timestamp,
      },
    };

    // Add battery level to update if provided
    if (batteryLevel !== undefined) {
      updateParams.UpdateExpression += ", batteryLevel = :batteryLevel";
      updateParams.ExpressionAttributeValues[":batteryLevel"] = batteryLevel;
    }

    await ddb.send(
      new PutCommand({
        TableName: TAGS_TABLE,
        Item: {
          tagId,
          lastSeen: timestamp,
          batteryLevel: batteryLevel || undefined,
          isAssigned: true, // Assuming if we get data, the tag exists and is assigned
        },
      }),
    );

    console.log(`Updated tag ${tagId} status`);
  } catch (error) {
    console.error(`Error updating tag status: ${error.message}`);
    // Continue processing even if tag update fails
  }
}

/**
 * Update the in-memory telemetry window for a tag
 */
function updateTelemetryWindow(tagId, reading) {
  if (!telemetryWindows[tagId]) {
    telemetryWindows[tagId] = [];
  }

  telemetryWindows[tagId].push(reading);

  // Keep window at fixed size
  if (telemetryWindows[tagId].length > WINDOW_SIZE) {
    telemetryWindows[tagId].shift();
  }
}

/**
 * Check if we can send an alert (not in cooldown period)
 */
async function canSendAlert(cattleId, alertType) {
  try {
    // Query recent alerts of this type for this cattle
    const result = await ddb.send(
      new QueryCommand({
        TableName: ALERTS_TABLE,
        IndexName: "CattleIdIndex",
        KeyConditionExpression: "cattleId = :cattleId",
        FilterExpression: "#type = :type AND #ts > :cooldownStart",
        ExpressionAttributeNames: {
          "#type": "type",
          "#ts": "timestamp",
        },
        ExpressionAttributeValues: {
          ":cattleId": cattleId,
          ":type": alertType,
          ":cooldownStart": Date.now() - COOLDOWN_PERIODS[alertType],
        },
        Limit: 1, // We only need to know if any such alert exists
      }),
    );

    // If no recent alerts exist, we can send alert
    return result.Items.length === 0;
  } catch (error) {
    console.error(`Error checking recent alerts: ${error.message}`);
    // If there's an error checking, allow the alert
    return true;
  }
}

/**
 * Process windowed data for alerts
 */
async function processWindowedData(tagId) {
  try {
    // Get the cattle associated with this tag
    const cattle = await getCattleByTagId(tagId);
    if (!cattle) {
      console.log(`No cattle found for tag ${tagId}`);
      return;
    }

    const readings = telemetryWindows[tagId];

    // Calculate averages
    const avgTemp = calculateAverage(readings, "temperature");
    const avgPulse = calculateAverage(readings, "pulseRate");
    const avgMotion = calculateAverage(readings, "motionData");
    const lastBattery = readings[readings.length - 1].batteryLevel;

    console.log(`Averages for ${cattle.name} (${tagId}): temp=${avgTemp}, pulse=${avgPulse}, motion=${avgMotion}, battery=${lastBattery}`);

    // Check for temperature alert
    if (avgTemp < THRESHOLDS.temperature.min || avgTemp > THRESHOLDS.temperature.max) {
      await createAndSendAlert(cattle, tagId, "temperature", avgTemp, THRESHOLDS.temperature);
    }

    // Check for pulse rate alert
    if (avgPulse < THRESHOLDS.pulseRate.min || avgPulse > THRESHOLDS.pulseRate.max) {
      await createAndSendAlert(cattle, tagId, "pulseRate", avgPulse, THRESHOLDS.pulseRate);
    }

    // Check for motion alert
    if (avgMotion > THRESHOLDS.motionData.max) {
      await createAndSendAlert(cattle, tagId, "motion", avgMotion, THRESHOLDS.motionData);
    }

    // Check for battery alert
    if (lastBattery !== undefined && lastBattery < THRESHOLDS.batteryLevel.min) {
      await createAndSendAlert(cattle, tagId, "battery", lastBattery, { min: THRESHOLDS.batteryLevel.min });
    }
  } catch (error) {
    console.error(`Error processing windowed data: ${error.message}`);
  }
}

/**
 * Calculate average of a specific field across readings
 */
function calculateAverage(readings, field) {
  // Filter out undefined values
  const validReadings = readings.filter((r) => r[field] !== undefined);

  if (validReadings.length === 0) return null;

  const sum = validReadings.reduce((acc, reading) => acc + reading[field], 0);
  return sum / validReadings.length;
}

/**
 * Get cattle by tag ID
 */
async function getCattleByTagId(tagId) {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: CATTLE_TABLE,
        IndexName: "TagIdIndex",
        KeyConditionExpression: "tagId = :tagId",
        ExpressionAttributeValues: {
          ":tagId": tagId,
        },
      }),
    );

    return result.Items?.[0];
  } catch (error) {
    console.error(`Error getting cattle by tag ID: ${error.message}`);
    throw error;
  }
}

/**
 * Create and send alert
 */
async function createAndSendAlert(cattle, tagId, type, value, threshold) {
  try {
    // Check if we're in cooldown period
    const canSend = await canSendAlert(cattle.cattleId, type);

    if (!canSend) {
      console.log(`Skipping ${type} alert for ${cattle.name} (${cattle.cattleId}) due to cooldown period`);
      return null;
    }

    const alertId = uuidv4();
    const now = Date.now();

    // Create alert in DynamoDB
    const alert = {
      alertId,
      userId: cattle.userId,
      cattleId: cattle.cattleId,
      tagId,
      timestamp: now,
      type,
      severity: calculateSeverity(type, value, threshold),
      value,
      threshold,
      status: "new",
    };

    await ddb.send(
      new PutCommand({
        TableName: ALERTS_TABLE,
        Item: alert,
      }),
    );

    console.log(`Created alert: ${JSON.stringify(alert)}`);

    // Get user details for notification
    const user = await getUserById(cattle.userId);

    if (user && user.phoneNumber) {
      await sendSmsNotification(user.phoneNumber, alert, cattle.name);
    }

    return alert;
  } catch (error) {
    console.error(`Error creating alert: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate severity based on how far the value deviates from thresholds
 */
function calculateSeverity(type, value, threshold) {
  switch (type) {
    case "temperature": {
      if (threshold.min !== undefined && value < threshold.min) {
        const deviation = threshold.min - value;
        if (deviation > 1.5) return "high";
        if (deviation > 0.5) return "medium";
        return "low";
      }

      if (threshold.max !== undefined && value > threshold.max) {
        const deviation = value - threshold.max;
        if (deviation > 1.5) return "high";
        if (deviation > 0.5) return "medium";
        return "low";
      }
      break;
    }

    case "pulseRate": {
      if (threshold.min !== undefined && value < threshold.min) {
        const deviation = threshold.min - value;
        if (deviation > 15) return "high";
        if (deviation > 5) return "medium";
        return "low";
      }

      if (threshold.max !== undefined && value > threshold.max) {
        const deviation = value - threshold.max;
        if (deviation > 15) return "high";
        if (deviation > 5) return "medium";
        return "low";
      }
      break;
    }

    case "battery": {
      if (value < 10) return "high";
      if (value < 15) return "medium";
      return "low";
    }

    case "motion": {
      if (value > threshold.max * 2) return "high";
      if (value > threshold.max * 1.5) return "medium";
      return "low";
    }
  }

  return "medium"; // Default
}

/**
 * Get user by ID
 */
async function getUserById(userId) {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      }),
    );

    return result.Item;
  } catch (error) {
    console.error(`Error getting user: ${error.message}`);
    return null;
  }
}

/**
 * Send SMS notification about the alert
 */
async function sendSmsNotification(phoneNumber, alert, cattleName) {
  try {
    // Format user-friendly message
    let message = `ALERT: Your cattle ${cattleName} has `;

    switch (alert.type) {
      case "temperature":
        message += `abnormal temperature (${alert.value.toFixed(1)}°C)`;
        break;
      case "pulseRate":
        message += `abnormal pulse rate (${Math.round(alert.value)} BPM)`;
        break;
      case "motion":
        message += `unusual activity detected`;
        break;
      case "battery":
        message += `low collar battery (${Math.round(alert.value)}%)`;
        break;
    }

    // Add severity indication
    message += `. Severity: ${alert.severity.toUpperCase()}. Check the app for details.`;

    // Send SMS
    await sns.send(
      new PublishCommand({
        PhoneNumber: phoneNumber,
        Message: message,
      }),
    );

    console.log(`SMS notification sent to ${phoneNumber}`);
  } catch (error) {
    console.error(`Error sending SMS notification: ${error.message}`);
    // Continue even if SMS fails - the alert is still stored
  }
}
