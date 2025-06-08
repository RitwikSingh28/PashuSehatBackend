#!/bin/bash

# Configuration
TAG_ID="ABC12345678"
AWS_REGION="ap-south-1"
TOPIC="cattle/$TAG_ID/telemetry"
BATTERY_LEVEL=90  # Initial battery level
INTERVAL=60  # 1 minute interval

echo "Starting IoT Telemetry Simulator"
echo "Sending data every $INTERVAL seconds"
echo "Press Ctrl+C to stop"
echo "-------------------------------"

while true; do
    # Get current timestamp
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    # Generate random temperature between 100°F and 105°F (normal cattle temp range in Fahrenheit)
    TEMP_WHOLE=$((100 + RANDOM % 5))
    TEMP_DECIMAL=$((RANDOM % 10))
    TEMPERATURE="$TEMP_WHOLE.$TEMP_DECIMAL"
    
    # Generate random pulse rate between 60 and 120
    PULSE_RATE=$((60 + RANDOM % 61))
    
    # Generate random motion data between 0.0 and 5.0
    MOTION_WHOLE=$((RANDOM % 5))
    MOTION_DECIMAL=$((RANDOM % 100))
    MOTION_DATA="$MOTION_WHOLE.$MOTION_DECIMAL"
    
    # Occasionally decrease battery level (1% chance)
    if [ $((RANDOM % 100)) -eq 0 ]; then
        BATTERY_LEVEL=$((BATTERY_LEVEL - 1))
        # Make sure battery doesn't go below 0
        if [ $BATTERY_LEVEL -lt 0 ]; then
            BATTERY_LEVEL=0
        fi
    fi
    
    # Create JSON payload
    PAYLOAD="{\"tagId\": \"$TAG_ID\", \"temperature\": $TEMPERATURE, \"pulseRate\": $PULSE_RATE, \"motionData\": $MOTION_DATA, \"batteryLevel\": $BATTERY_LEVEL}"
    
    # Base64 encode the payload
    BASE64_PAYLOAD=$(echo -n "$PAYLOAD" | base64)
    
    # Send to AWS IoT Core
    echo "[$TIMESTAMP] Sending: $PAYLOAD"
    aws iot-data publish \
        --topic "$TOPIC" \
        --payload "$BASE64_PAYLOAD" \
        --region "$AWS_REGION"

    # Check if command succeeded
    if [ $? -eq 0 ]; then
        echo "Published successfully ✅"
    else
        echo "Publish failed ❌"
    fi
    
    echo "-------------------------------"
    echo "Next update in $INTERVAL seconds..."
    
    # Wait for the specified interval
    sleep $INTERVAL
done
